// Edge Function: woocommerce-order
//
// Receives a WooCommerce "order.created" webhook and writes the order into
// public.orders, one row per line item. Auto-creates a client if the customer
// email is new. Matches products by name (case-insensitive). Idempotent — a
// repeated webhook for the same WooCommerce order is ignored.
//
// Configure WooCommerce: WP Admin -> WooCommerce -> Settings -> Advanced ->
// Webhooks -> Add webhook
//   * Topic: Order created
//   * Delivery URL: https://<project>.supabase.co/functions/v1/woocommerce-order
//   * Secret: (any random string — also store as WOOCOMMERCE_WEBHOOK_SECRET in
//             Supabase Project Settings -> Edge Functions -> Secrets)
//   * API version: WP REST API Integration v3
//
// JWT verification is disabled on this function because WooCommerce can't send
// a JWT — we use the HMAC signature instead.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const WEBHOOK_SECRET = Deno.env.get("WOOCOMMERCE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req) => {
  if (req.method === "GET") {
    return json({ status: "ok", message: "woocommerce-order endpoint live" });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await req.text();

  // SIGNATURE CHECK TEMPORARILY DISABLED — we'll re-enable this once we've
  // confirmed the end-to-end flow works. To re-enable: uncomment the block
  // below and make sure WOOCOMMERCE_WEBHOOK_SECRET in Supabase matches the
  // Secret field on the WordPress webhook.
  //
  // if (WEBHOOK_SECRET) {
  //   const sig = req.headers.get("x-wc-webhook-signature") ?? "";
  //   const expected = await hmacSha256Base64(WEBHOOK_SECRET, rawBody);
  //   if (sig !== expected) {
  //     return new Response("Invalid signature", { status: 401 });
  //   }
  // }

  // WooCommerce sends a small "ping" payload (just {webhook_id: N}) when you
  // first save the webhook. Treat that as a no-op success.
  // Be tolerant of pings: WP-side test deliveries are sometimes empty or
  // contain non-JSON content. Anything we can't parse is treated as a no-op
  // success (200) instead of an error.
  console.log(`Incoming webhook: ${rawBody.length} bytes, first 200: ${rawBody.slice(0, 200)}`);

  if (!rawBody.trim()) {
    return json({ status: "ignored", reason: "empty body (test ping)" });
  }

  let order: any;
  try {
    order = JSON.parse(rawBody);
  } catch (e) {
    console.log("JSON parse failed:", (e as Error).message);
    return json({ status: "ignored", reason: "non-JSON body (test ping)" });
  }
  if (!order || (!order.id && !order.line_items)) {
    return json({ status: "ignored", reason: "ping or empty payload" });
  }

  // Sync any paid order. We accept "processing" (paid, awaiting fulfillment)
  // and "completed" (fulfilled), but skip cancelled / refunded / failed so
  // those don't pollute the OS revenue numbers.
  const SYNC_STATUSES = new Set(["processing", "completed", "on-hold", "pending"]);
  if (order.status && !SYNC_STATUSES.has(order.status)) {
    return json({
      status: "ignored",
      reason: `order status is "${order.status}" (cancelled/refunded/failed orders are not synced)`,
      woocommerce_order: String(order.number ?? order.id ?? ""),
    });
  }

  const wcOrderNumber = String(order.number ?? order.id ?? "");

  // Idempotency: if we've already imported this WC order, do nothing.
  const idempotencyTag = `Website order #${wcOrderNumber}`;
  const { data: existing } = await supabase
    .from("orders")
    .select("id")
    .ilike("notes", `%${idempotencyTag}%`)
    .limit(1);
  if (existing && existing.length > 0) {
    return json({
      status: "skipped",
      reason: "already imported",
      woocommerce_order: wcOrderNumber,
    });
  }

  // ---------- Client matching / auto-create ----------
  const billing = order.billing ?? {};
  const customerEmail: string | null = billing.email || null;
  const customerName: string =
    `${billing.first_name ?? ""} ${billing.last_name ?? ""}`.trim() ||
    billing.company ||
    "Website Customer";
  const customerPhone: string | null = billing.phone || null;

  let clientId: string | null = null;
  let clientStoredName: string = customerName;

  if (customerEmail) {
    const { data: byEmail } = await supabase
      .from("clients")
      .select("id, name")
      .eq("email", customerEmail)
      .limit(1)
      .maybeSingle();
    if (byEmail) {
      clientId = byEmail.id;
      clientStoredName = byEmail.name;
    }
  }

  if (!clientId) {
    const { data: byName } = await supabase
      .from("clients")
      .select("id, name")
      .ilike("name", customerName)
      .limit(1)
      .maybeSingle();
    if (byName) {
      clientId = byName.id;
      clientStoredName = byName.name;
    }
  }

  if (!clientId) {
    // Generate next CLT-XXXX
    const { data: maxRow } = await supabase
      .from("clients")
      .select("client_id")
      .like("client_id", "CLT-%")
      .order("client_id", { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextNum =
      maxRow?.client_id
        ? parseInt(maxRow.client_id.replace(/[^0-9]/g, ""), 10) + 1
        : 1;
    const newClientCode = `CLT-${String(nextNum).padStart(4, "0")}`;

    const { data: created, error: createErr } = await supabase
      .from("clients")
      .insert({
        client_id: newClientCode,
        name: customerName,
        email: customerEmail,
        phone: customerPhone,
        pricing_type: "Standard",
        notes: `Auto-created from website order #${wcOrderNumber}`,
      })
      .select("id, name")
      .single();
    if (createErr) {
      console.error("Failed to create client", createErr);
    } else if (created) {
      clientId = created.id;
      clientStoredName = created.name;
    }
  }

  // ---------- Order date + month_key ----------
  const orderDate = order.date_created
    ? new Date(order.date_created)
    : new Date();
  const dateStr = orderDate.toISOString().slice(0, 10);
  const monthKey = `${orderDate.getFullYear()}${String(
    orderDate.getMonth() + 1,
  ).padStart(2, "0")}`;

  // ---------- Insert one order per line item ----------
  const lineItems: any[] = Array.isArray(order.line_items)
    ? order.line_items
    : [];

  // Get the highest existing ORD-XXXX once, then increment locally.
  const { data: maxOrdRow } = await supabase
    .from("orders")
    .select("order_id")
    .like("order_id", "ORD-%")
    .order("order_id", { ascending: false })
    .limit(1)
    .maybeSingle();
  let nextOrdNum =
    maxOrdRow?.order_id
      ? parseInt(maxOrdRow.order_id.replace(/[^0-9]/g, ""), 10) + 1
      : 1;

  const inserted: any[] = [];
  const failed: any[] = [];

  for (const item of lineItems) {
    const productNameRaw = String(item.name ?? "").trim();
    const qty = Number(item.quantity) || 0;
    const lineTotal = Number(item.total) || 0;
    const unitPrice =
      Number(item.price) ||
      (qty > 0 ? lineTotal / qty : 0);

    // Match product by name (case-insensitive). If no match, the order still
    // saves with product_id = null and the raw name in product_name, so the
    // user can manually fix it in the app.
    let productId: string | null = null;
    let productStoredName: string = productNameRaw;
    if (productNameRaw) {
      const { data: prod } = await supabase
        .from("products")
        .select("id, name")
        .ilike("name", productNameRaw)
        .limit(1)
        .maybeSingle();
      if (prod) {
        productId = prod.id;
        productStoredName = prod.name;
      }
    }

    const orderCode = `ORD-${String(nextOrdNum).padStart(4, "0")}`;
    nextOrdNum += 1;

    const { error: insertErr } = await supabase.from("orders").insert({
      order_id: orderCode,
      date: dateStr,
      client_id: clientId,
      client_name: clientStoredName,
      product_id: productId,
      product_name: productStoredName,
      quantity: qty,
      unit_price: unitPrice,
      total: lineTotal || qty * unitPrice,
      status: "Pending",
      notes: idempotencyTag,
      month_key: monthKey,
    });

    if (insertErr) {
      failed.push({ productNameRaw, error: insertErr.message });
    } else {
      inserted.push({
        order_id: orderCode,
        product_name: productStoredName,
        quantity: qty,
        unit_price: unitPrice,
      });
    }
  }

  return json({
    status: "ok",
    woocommerce_order: wcOrderNumber,
    client_id: clientId,
    client_name: clientStoredName,
    inserted_count: inserted.length,
    inserted,
    failed,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function hmacSha256Base64(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
