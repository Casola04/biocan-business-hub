import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase, type Product } from "@/lib/supabase";
import { fmtMoney, nextId } from "@/lib/format";
import { Plus, Pencil, Trash2, Search, PackagePlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/inventory")({ component: InventoryPage });

type FormState = {
  name: string;
  sku: string;
  unit_price: string;
  stock_qty: string;
  reorder_level: string;
  supplier: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  sku: "",
  unit_price: "0",
  stock_qty: "0",
  reorder_level: "5",
  supplier: "",
  notes: "",
});

function InventoryPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [restock, setRestock] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState("0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Product[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((p) =>
      [p.name, p.sku, p.supplier, p.product_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  function suggestNextSku(): string {
    const skus = (data ?? [])
      .map((p) => p.sku)
      .filter((s): s is string => !!s && /^EPA-\d+$/i.test(s));
    return nextId("EPA", skus).replace(/EPA-0*(\d{1,3})$/i, (_, n) => `EPA-${String(n).padStart(3, "0")}`);
  }

  function openCreate() {
    setEditing(null);
    setForm({ ...emptyForm(), sku: suggestNextSku() });
    setOpen(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku ?? "",
      unit_price: String(p.unit_price ?? 0),
      stock_qty: String(p.stock_qty ?? 0),
      reorder_level: String(p.reorder_level ?? 5),
      supplier: p.supplier ?? "",
      notes: p.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Product name is required");
      return;
    }
    const sku = form.sku.trim() || suggestNextSku();
    const payload = {
      name: form.name.trim(),
      sku,
      unit_price: Number(form.unit_price) || 0,
      stock_qty: parseInt(form.stock_qty, 10) || 0,
      reorder_level: parseInt(form.reorder_level, 10) || 0,
      supplier: form.supplier.trim() || null,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Product updated");
    } else {
      const ids = (data ?? []).map((p) => p.product_id);
      const product_id = nextId("PRD", ids);
      const { error } = await supabase.from("products").insert({ product_id, ...payload });
      if (error) return toast.error(error.message);
      toast.success(`Product ${product_id} added`);
    }

    setOpen(false);
    setEditing(null);
    setForm(emptyForm());
    qc.invalidateQueries({ queryKey: ["products"] });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("products").delete().eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
    }
    setConfirmDelete(null);
  }

  function openRestock(p: Product) {
    setRestock(p);
    setRestockQty(String(p.stock_qty ?? 0));
  }

  async function handleRestock() {
    if (!restock) return;
    const qty = parseInt(restockQty, 10);
    if (isNaN(qty) || qty < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const { error } = await supabase
      .from("products")
      .update({ stock_qty: qty })
      .eq("id", restock.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`${restock.name} restocked to ${qty}`);
      qc.invalidateQueries({ queryKey: ["products"] });
    }
    setRestock(null);
  }

  return (
    <AppLayout title="Inventory">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products, SKU, supplier..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>

      <Card>
        {error ? (
          <div className="p-6 text-sm text-destructive">
            Error loading products: {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product Name</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Sale Price</TableHead>
                <TableHead className="text-right">On Hand</TableHead>
                <TableHead className="text-right">Reorder Level</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => {
                const onHand = Number(p.stock_qty);
                const reorder = Number(p.reorder_level);
                const low = onHand <= reorder;
                return (
                  <TableRow
                    key={p.id}
                    className={low ? "border-l-4 border-l-destructive" : ""}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{p.name}</span>
                        {low && (
                          <Badge
                            variant="outline"
                            className="bg-destructive/10 text-destructive border-destructive/30 gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-right font-medium">
                      {fmtMoney(Number(p.unit_price))}
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        low ? "text-destructive" : "text-success"
                      }`}
                    >
                      {onHand}
                    </TableCell>
                    <TableCell className="text-right">{reorder}</TableCell>
                    <TableCell>{p.supplier ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        {low && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openRestock(p)}
                          >
                            <PackagePlus className="h-3.5 w-3.5 mr-1" />
                            Restock
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(p)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    {search ? "No products match your search." : "No products yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add/Edit slide-over */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Product" : "New Product"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                placeholder={suggestNextSku()}
                value={form.sku}
                onChange={(e) => setForm({ ...form, sku: e.target.value })}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to auto-assign next EPA-XXX
              </p>
            </div>
            <div>
              <Label htmlFor="price">Sale Price ($)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="onhand">On Hand</Label>
                <Input
                  id="onhand"
                  type="number"
                  min="0"
                  value={form.stock_qty}
                  onChange={(e) => setForm({ ...form, stock_qty: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="reorder">Reorder Level</Label>
                <Input
                  id="reorder"
                  type="number"
                  min="0"
                  value={form.reorder_level}
                  onChange={(e) => setForm({ ...form, reorder_level: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="supplier">Supplier</Label>
              <Input
                id="supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editing ? "Save Changes" : "Create Product"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Quick restock */}
      <Dialog open={!!restock} onOpenChange={(o) => !o && setRestock(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restock {restock?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm text-muted-foreground">
              Current on hand:{" "}
              <span className="text-destructive font-semibold">{restock?.stock_qty}</span>{" "}
              · Reorder level: {restock?.reorder_level}
            </div>
            <div>
              <Label htmlFor="restock-qty">New On Hand Quantity</Label>
              <Input
                id="restock-qty"
                type="number"
                min="0"
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestock(null)}>
              Cancel
            </Button>
            <Button onClick={handleRestock}>Update Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.name} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
