import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Database, ShieldAlert, Loader2, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/seed")({ component: SeedPage });

type SeedProduct = {
  product_id: string;
  name: string;
  sku: string;
  unit_price: number;
  stock_qty: number;
  reorder_level: number;
};

const SEED_PRODUCTS: SeedProduct[] = [
  { product_id: "PRD-0001", name: "BPC-157",         sku: "EPA-001", unit_price: 115, stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0002", name: "BPC-157/TB-500",  sku: "EPA-002", unit_price: 175, stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0003", name: "Retatrutide",     sku: "EPA-003", unit_price: 175, stock_qty: 11, reorder_level: 5 },
  { product_id: "PRD-0004", name: "NAD+",            sku: "EPA-004", unit_price: 100, stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0005", name: "Ipamorelin",      sku: "EPA-005", unit_price: 135, stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0006", name: "GHK-CU",          sku: "EPA-006", unit_price: 115, stock_qty: 14, reorder_level: 5 },
  { product_id: "PRD-0007", name: "Tesamorelin",     sku: "EPA-007", unit_price: 175, stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0008", name: "Glutithione",     sku: "EPA-008", unit_price: 100, stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0009", name: "Semax",           sku: "EPA-009", unit_price: 85,  stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0010", name: "Melanotan 2",     sku: "EPA-010", unit_price: 80,  stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0011", name: "Mots-C",          sku: "EPA-011", unit_price: 190, stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0012", name: "SLUPP-332",       sku: "EPA-012", unit_price: 115, stock_qty: 5,  reorder_level: 5 },
  { product_id: "PRD-0013", name: "CJC-DAC",         sku: "EPA-013", unit_price: 120, stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0014", name: "Sermorelin",      sku: "EPA-014", unit_price: 120, stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0015", name: "KPV",             sku: "EPA-015", unit_price: 85,  stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0016", name: "Epitalon",        sku: "EPA-016", unit_price: 80,  stock_qty: 0,  reorder_level: 5 },
  { product_id: "PRD-0017", name: "BAC Water",       sku: "EPA-017", unit_price: 25,  stock_qty: 1,  reorder_level: 5 },
  { product_id: "PRD-0018", name: "Kisspeptin",      sku: "EPA-018", unit_price: 95,  stock_qty: 5,  reorder_level: 5 },
];

function SeedPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSeed() {
    setRunning(true);
    try {
      const { count, error: countErr } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });
      if (countErr) throw countErr;
      if ((count ?? 0) > 0) {
        toast.error(`Seeding blocked: ${count} product(s) already exist`);
        return;
      }

      const payload = SEED_PRODUCTS.map((p) => ({ ...p, unit_cost: 0, supplier: null, notes: null }));
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;

      toast.success(`Seeded ${SEED_PRODUCTS.length} products`);
      setDone(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  if (authLoading) {
    return (
      <AppLayout title="Seed Database">
        <div className="text-sm text-muted-foreground">Checking permissions...</div>
      </AppLayout>
    );
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Seed Database">
        <Card className="p-8 max-w-lg flex flex-col items-center text-center gap-3">
          <ShieldAlert className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold">Admin Only</h2>
          <p className="text-sm text-muted-foreground">
            You need an admin role to seed the database.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Back to dashboard</Link>
          </Button>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Seed Database">
      <Card className="p-6 max-w-2xl space-y-4">
        <div className="flex items-start gap-3">
          <Database className="h-6 w-6 text-primary mt-1" />
          <div>
            <h2 className="text-lg font-semibold">Populate starter products</h2>
            <p className="text-sm text-muted-foreground">
              Inserts {SEED_PRODUCTS.length} peptide products into the inventory.
              This will only run if the products table is empty.
            </p>
          </div>
        </div>

        <div className="rounded-md border max-h-72 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Name</th>
                <th className="text-right px-3 py-2">Price</th>
                <th className="text-right px-3 py-2">On Hand</th>
              </tr>
            </thead>
            <tbody>
              {SEED_PRODUCTS.map((p) => (
                <tr key={p.sku} className="border-t">
                  <td className="px-3 py-1.5 font-mono text-xs">{p.sku}</td>
                  <td className="px-3 py-1.5">{p.name}</td>
                  <td className="px-3 py-1.5 text-right">${p.unit_price}</td>
                  <td className="px-3 py-1.5 text-right">{p.stock_qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSeed} disabled={running || done}>
            {running ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Seeding...</>
            ) : done ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> Seeded</>
            ) : (
              "Seed Products"
            )}
          </Button>
          {done && (
            <Button asChild variant="outline">
              <Link to="/inventory">Go to inventory</Link>
            </Button>
          )}
        </div>
      </Card>
    </AppLayout>
  );
}
