import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase, type Order, type Client, type Product } from "@/lib/supabase";
import { fmtMoney, monthKey, nextId, todayISO } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

function OrdersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    date: todayISO(), client_id: "", product_id: "", quantity: "1", unit_price: "", status: "Pending", notes: "",
  });

  const ordersQ = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["clients", "select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, client_id, name").order("name");
      if (error) throw error;
      return (data ?? []) as Pick<Client, "id" | "client_id" | "name">[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["products", "select"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, product_id, name, unit_price, stock_qty").order("name");
      if (error) throw error;
      return (data ?? []) as (Pick<Product, "id" | "product_id" | "name" | "unit_price" | "stock_qty">)[];
    },
  });

  const selectedProduct = useMemo(
    () => productsQ.data?.find((p) => p.id === form.product_id),
    [productsQ.data, form.product_id],
  );

  function pickProduct(id: string) {
    const p = productsQ.data?.find((x) => x.id === id);
    setForm((f) => ({ ...f, product_id: id, unit_price: p ? String(p.unit_price) : f.unit_price }));
  }

  async function handleCreate() {
    if (!form.client_id || !form.product_id) return toast.error("Client and product required");
    const qty = Number(form.quantity);
    const price = Number(form.unit_price);
    if (qty <= 0 || price < 0) return toast.error("Invalid qty or price");
    const client = clientsQ.data?.find((c) => c.id === form.client_id);
    const product = productsQ.data?.find((p) => p.id === form.product_id);
    const ids = (ordersQ.data ?? []).map((o) => o.order_id);
    const order_id = nextId("ORD", ids);
    const total = qty * price;
    const mk = monthKey(form.date);

    const { error } = await supabase.from("orders").insert({
      order_id,
      date: form.date,
      client_id: form.client_id,
      client_name: client?.name ?? null,
      product_id: form.product_id,
      product_name: product?.name ?? null,
      quantity: qty,
      unit_price: price,
      total,
      status: form.status,
      notes: form.notes || null,
      month_key: mk,
    });
    if (error) return toast.error(error.message);

    // decrement stock
    if (product) {
      const newStock = Math.max(0, Number(product.stock_qty) - qty);
      await supabase.from("products").update({ stock_qty: newStock }).eq("id", product.id);
    }

    toast.success(`Order ${order_id} created`);
    setOpen(false);
    setForm({ date: todayISO(), client_id: "", product_id: "", quantity: "1", unit_price: "", status: "Pending", notes: "" });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("orders").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Order deleted");
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  const previewTotal = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);

  return (
    <AppLayout title="Orders">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{ordersQ.data?.length ?? 0} order(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />New Order</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
              <div>
                <Label>Client</Label>
                <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {(clientsQ.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Product</Label>
                <Select value={form.product_id} onValueChange={pickProduct}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {(productsQ.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name} (stock: {p.stock_qty})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Quantity</Label><Input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></div>
                <div><Label>Unit Price</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Shipped">Shipped</SelectItem>
                    <SelectItem value="Cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="text-sm text-muted-foreground">Total: <span className="font-semibold text-success">{fmtMoney(previewTotal)}</span>{selectedProduct && Number(form.quantity) > Number(selectedProduct.stock_qty) ? <span className="text-destructive ml-2">(exceeds stock)</span> : null}</div>
            </div>
            <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        {ordersQ.error ? (
          <div className="p-6 text-sm text-destructive">Error: {(ordersQ.error as Error).message}</div>
        ) : ordersQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Date</TableHead><TableHead>Client</TableHead>
                <TableHead>Product</TableHead><TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Price</TableHead><TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ordersQ.data ?? []).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                  <TableCell>{o.date}</TableCell>
                  <TableCell>{o.client_name}</TableCell>
                  <TableCell>{o.product_name}</TableCell>
                  <TableCell className="text-right">{o.quantity}</TableCell>
                  <TableCell className="text-right">{fmtMoney(Number(o.unit_price))}</TableCell>
                  <TableCell className="text-right text-success font-semibold">{fmtMoney(Number(o.total))}</TableCell>
                  <TableCell><Badge variant={o.status === "Paid" || o.status === "Shipped" ? "default" : "secondary"}>{o.status}</Badge></TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => handleDelete(o.id)}><Trash2 className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
              {(ordersQ.data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No orders yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
