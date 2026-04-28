import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase, type Product } from "@/lib/supabase";
import { fmtMoney, nextId } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

function InventoryPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", sku: "", unit_cost: "0", unit_price: "0", stock_qty: "0", reorder_level: "0", notes: "",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  async function handleCreate() {
    if (!form.name.trim()) return toast.error("Name required");
    const ids = (data ?? []).map((p) => p.product_id);
    const product_id = nextId("PRD", ids);
    const { error } = await supabase.from("products").insert({
      product_id,
      name: form.name,
      sku: form.sku || null,
      unit_cost: Number(form.unit_cost),
      unit_price: Number(form.unit_price),
      stock_qty: Number(form.stock_qty),
      reorder_level: Number(form.reorder_level),
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Product ${product_id} added`);
    setOpen(false);
    setForm({ name: "", sku: "", unit_cost: "0", unit_price: "0", stock_qty: "0", reorder_level: "0", notes: "" });
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Product deleted");
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  return (
    <AppLayout title="Inventory">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} product(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Product</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Unit Cost</Label><Input type="number" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></div>
                <div><Label>Unit Price</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></div>
                <div><Label>Stock Qty</Label><Input type="number" value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} /></div>
                <div><Label>Reorder Level</Label><Input type="number" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        {error ? (
          <div className="p-6 text-sm text-destructive">Error: {(error as Error).message}</div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>SKU</TableHead>
                <TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Reorder</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((p) => {
                const low = Number(p.stock_qty) <= Number(p.reorder_level);
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">{p.product_id}</TableCell>
                    <TableCell className="font-medium">{p.name}</TableCell>
                    <TableCell>{p.sku}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(p.unit_cost))}</TableCell>
                    <TableCell className="text-right text-success font-medium">{fmtMoney(Number(p.unit_price))}</TableCell>
                    <TableCell className={`text-right ${low ? "text-destructive font-semibold" : ""}`}>{p.stock_qty}</TableCell>
                    <TableCell className="text-right">{p.reorder_level}</TableCell>
                    <TableCell>{isAdmin && <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>}</TableCell>
                  </TableRow>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No products yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
