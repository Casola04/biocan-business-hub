import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Calendar } from "@/components/ui/calendar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase, type Order, type Client, type Product } from "@/lib/supabase";
import { fmtMoney, formatMonthKey, monthKey, nextId, todayISO } from "@/lib/format";
import { Plus, Pencil, Trash2, Calendar as CalendarIcon, Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { applyDistributorScope, distributorIdForInsert, useDataScope } from "@/lib/scope";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/orders")({ component: OrdersPage });

const ALL = "__all__";

type FormState = {
  date: string;
  order_id: string;
  client_id: string; // clients.id (uuid)
  product_id: string; // products.id (uuid)
  quantity: string;
  unit_price: string;
  notes: string;
};

const emptyForm = (suggestedOrderId: string): FormState => ({
  date: todayISO(),
  order_id: suggestedOrderId,
  client_id: "",
  product_id: "",
  quantity: "1",
  unit_price: "",
  notes: "",
});

function OrdersPage() {
  const { isAdmin, isDistributor, splitPct } = useAuth();
  const scope = useDataScope();
  const showSplit = scope.kind !== "admin";
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null);

  // Filters
  const [filterClient, setFilterClient] = useState<string>(ALL);
  const [filterProduct, setFilterProduct] = useState<string>(ALL);
  const [filterMonth, setFilterMonth] = useState<string>(ALL);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const ordersQ = useQuery({
    queryKey: ["orders", scope],
    queryFn: async () => {
      let q = supabase.from("orders").select("*").order("date", { ascending: false });
      q = applyDistributorScope(q, scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["clients", "select", scope],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, client_id, name, pricing_type")
        .order("name");
      q = applyDistributorScope(q, scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Pick<Client, "id" | "client_id" | "name" | "pricing_type">[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["products", "select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_id, name, unit_cost, unit_price, stock_qty, reorder_level")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Pick<
        Product,
        "id" | "product_id" | "name" | "unit_cost" | "unit_price" | "stock_qty" | "reorder_level"
      >[];
    },
  });

  const selectedClient = useMemo(
    () => clientsQ.data?.find((c) => c.id === form.client_id),
    [clientsQ.data, form.client_id],
  );
  const selectedProduct = useMemo(
    () => productsQ.data?.find((p) => p.id === form.product_id),
    [productsQ.data, form.product_id],
  );

  // Re-price when client or product changes
  useEffect(() => {
    if (!selectedProduct) return;
    const isAtCost = selectedClient?.pricing_type === "At Cost";
    const price = isAtCost
      ? Number(selectedProduct.unit_cost ?? 0)
      : Number(selectedProduct.unit_price ?? 0);
    setForm((f) => ({ ...f, unit_price: String(price) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.product_id, form.client_id]);

  // Suggest next order id when opening / when orders change
  function suggestOrderId() {
    const ids = (ordersQ.data ?? []).map((o) => o.order_id);
    return nextId("ORD", ids);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(suggestOrderId()));
    setOpen(true);
  }

  function openEdit(o: Order) {
    setEditing(o);
    setForm({
      date: o.date,
      order_id: o.order_id,
      client_id: o.client_id ?? "",
      product_id: o.product_id ?? "",
      quantity: String(o.quantity),
      unit_price: String(o.unit_price),
      notes: o.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.client_id) return toast.error("Client is required");
    if (!form.product_id) return toast.error("Product is required");
    const qty = parseInt(form.quantity, 10);
    const price = Number(form.unit_price);
    if (!qty || qty <= 0) return toast.error("Quantity must be > 0");
    if (isNaN(price) || price < 0) return toast.error("Invalid unit price");

    const client = clientsQ.data?.find((c) => c.id === form.client_id);
    const product = productsQ.data?.find((p) => p.id === form.product_id);
    if (!product) return toast.error("Product not found");

    const order_id = form.order_id.trim() || suggestOrderId();
    const total = qty * price;
    const mk = monthKey(form.date);

    const payload = {
      order_id,
      date: form.date,
      client_id: client?.id ?? null,
      client_name: client?.name ?? null,
      product_id: product.id ?? null,
      product_name: product.name ?? null,
      quantity: qty,
      unit_price: price,
      total,
      notes: form.notes || null,
      month_key: mk,
      // When the page is rendered for a distributor (their own /orders OR
      // admin viewing /distributors/:id/...), tie the new order to that
      // distributor. For admin's own /orders, leave null.
      distributor_id: editing ? editing.distributor_id : distributorIdForInsert(scope),
    };

    if (editing) {
      const { error } = await supabase.from("orders").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);

      // Adjust stock by the delta in quantity (only if product unchanged)
      if (editing.product_id === product.id) {
        const delta = qty - Number(editing.quantity);
        if (delta !== 0) {
          const newStock = Math.max(0, Number(product.stock_qty) - delta);
          const { error: updErr } = await supabase
            .from("products")
            .update({ stock_qty: newStock })
            .eq("id", product.id);
          if (updErr) toast.error(`Stock update failed: ${updErr.message}`);
        }
      }
      toast.success(`Order ${order_id} updated`);
    } else {
      const { error } = await supabase.from("orders").insert({ ...payload, status: "Pending" });
      if (error) return toast.error(error.message);

      // Decrement stock
      const newStock = Math.max(0, Number(product.stock_qty) - qty);
      const { error: updErr } = await supabase
        .from("products")
        .update({ stock_qty: newStock })
        .eq("id", product.id);
      if (updErr) toast.error(`Stock update failed: ${updErr.message}`);

      toast.success(`Order ${order_id} created`);
      if (newStock <= Number(product.reorder_level)) {
        toast.warning(
          `${product.name} is now at ${newStock} (reorder level ${product.reorder_level})`,
        );
      }
    }

    setOpen(false);
    setEditing(null);
    setForm(emptyForm(""));
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("orders").delete().eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Order deleted");
      qc.invalidateQueries({ queryKey: ["orders"] });
    }
    setConfirmDelete(null);
  }

  const months = useMemo(() => {
    const set = new Set<string>();
    (ordersQ.data ?? []).forEach((o) => o.month_key && set.add(o.month_key));
    return Array.from(set).sort().reverse();
  }, [ordersQ.data]);

  const filtered = useMemo(() => {
    return (ordersQ.data ?? []).filter((o) => {
      if (filterClient !== ALL && o.client_id !== filterClient) return false;
      if (filterProduct !== ALL && o.product_id !== filterProduct) return false;
      if (filterMonth !== ALL && o.month_key !== filterMonth) return false;
      if (dateFrom && new Date(o.date) < dateFrom) return false;
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(o.date) > end) return false;
      }
      return true;
    });
  }, [ordersQ.data, filterClient, filterProduct, filterMonth, dateFrom, dateTo]);

  const previewTotal = (Number(form.quantity) || 0) * (Number(form.unit_price) || 0);
  const stockAfter = selectedProduct
    ? Number(selectedProduct.stock_qty) - (Number(form.quantity) || 0)
    : null;

  function clearFilters() {
    setFilterClient(ALL);
    setFilterProduct(ALL);
    setFilterMonth(ALL);
    setDateFrom(undefined);
    setDateTo(undefined);
  }
  const hasFilters =
    filterClient !== ALL ||
    filterProduct !== ALL ||
    filterMonth !== ALL ||
    !!dateFrom ||
    !!dateTo;

  return (
    <AppLayout title="Orders">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 flex-1">
          <DateRangeButton label="From" value={dateFrom} onChange={setDateFrom} />
          <DateRangeButton label="To" value={dateTo} onChange={setDateTo} />
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All clients</SelectItem>
              {(clientsQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All products</SelectItem>
              {(productsQ.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger><SelectValue placeholder="Month" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All months</SelectItem>
              {months.map((m) => (
                <SelectItem key={m} value={m}>
                  {formatMonthKey(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters}>
              <X className="h-4 w-4 mr-1" /> Clear
            </Button>
          )}
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" /> New Order
          </Button>
        </div>
      </div>

      <Card>
        {ordersQ.error ? (
          <div className="p-6 text-sm text-destructive">
            Error: {(ordersQ.error as Error).message}
          </div>
        ) : ordersQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                {showSplit && <TableHead className="text-right">Your Cut ({splitPct}%)</TableHead>}
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => {
                const prod = productsQ.data?.find((p) => p.id === o.product_id);
                const cost = prod ? Number(prod.unit_cost) : 0;
                const profit = (Number(o.unit_price) - cost) * Number(o.quantity);
                const myCut = profit * (splitPct / 100);
                return (
                  <TableRow key={o.id}>
                    <TableCell>{o.date}</TableCell>
                    <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                    <TableCell>{o.client_name ?? "—"}</TableCell>
                    <TableCell>{o.product_name ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.quantity}</TableCell>
                    <TableCell className="text-right">{fmtMoney(Number(o.unit_price))}</TableCell>
                    <TableCell className="text-right text-success font-semibold">
                      {fmtMoney(Number(o.total))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        profit >= 0 ? "text-success" : "text-destructive",
                      )}
                    >
                      {fmtMoney(profit)}
                    </TableCell>
                    {showSplit && (
                      <TableCell className="text-right text-success font-semibold">
                        {fmtMoney(myCut)}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant="outline">{formatMonthKey(o.month_key)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {(isAdmin || isDistributor) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setConfirmDelete(o)}
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
                  <TableCell colSpan={showSplit ? 11 : 10} className="text-center text-muted-foreground py-8">
                    {hasFilters ? "No orders match the filters." : "No orders yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* New Order slide-over */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit Order ${editing.order_id}` : "New Order"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Order ID</Label>
                <Input
                  value={form.order_id}
                  onChange={(e) => setForm({ ...form, order_id: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Client</Label>
              <SearchableCombo
                placeholder="Select client..."
                value={form.client_id}
                options={(clientsQ.data ?? []).map((c) => ({
                  value: c.id,
                  label: c.name,
                  hint: c.pricing_type === "At Cost" ? "At Cost" : "Standard",
                }))}
                onChange={(v) => setForm({ ...form, client_id: v })}
              />
            </div>

            <div>
              <Label>Product</Label>
              <SearchableCombo
                placeholder="Select product..."
                value={form.product_id}
                options={(productsQ.data ?? []).map((p) => ({
                  value: p.id,
                  label: p.name,
                  hint: `${fmtMoney(Number(p.unit_price))} · stock ${p.stock_qty}`,
                }))}
                onChange={(v) => setForm({ ...form, product_id: v })}
              />
              {selectedProduct && (
                <p className="text-xs text-muted-foreground mt-1">
                  Sale price: {fmtMoney(Number(selectedProduct.unit_price))} · Cost:{" "}
                  {fmtMoney(Number(selectedProduct.unit_cost))}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                />
              </div>
              <div>
                <Label>
                  Unit Price{" "}
                  {selectedClient?.pricing_type === "At Cost" && (
                    <span className="text-xs text-orange-600">(at cost)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.unit_price}
                  onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Revenue</Label>
              <Input readOnly value={fmtMoney(previewTotal)} className="font-semibold" />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            {selectedProduct && stockAfter !== null && (
              <div
                className={cn(
                  "text-sm rounded-md border px-3 py-2",
                  stockAfter < 0
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : stockAfter <= Number(selectedProduct.reorder_level)
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-700"
                    : "border-border bg-muted/40 text-muted-foreground",
                )}
              >
                Stock after order: <span className="font-semibold">{stockAfter}</span>{" "}
                (reorder at {selectedProduct.reorder_level})
              </div>
            )}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editing ? "Save Changes" : "Create Order"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order {confirmDelete?.order_id} will be permanently removed. Stock will not
              be automatically restored.
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

function DateRangeButton({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date | undefined;
  onChange: (d: Date | undefined) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-start text-left font-normal", !value && "text-muted-foreground")}>
          <CalendarIcon className="h-4 w-4 mr-2" />
          {value ? format(value, "MMM d, yyyy") : label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}

function SearchableCombo({
  value,
  options,
  onChange,
  placeholder,
}: {
  value: string;
  options: { value: string; label: string; hint?: string }[];
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between font-normal"
        >
          <span className={cn(!selected && "text-muted-foreground")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={`${o.label} ${o.hint ?? ""}`}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("h-4 w-4 mr-2", value === o.value ? "opacity-100" : "opacity-0")} />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <span>{o.label}</span>
                    {o.hint && <span className="text-xs text-muted-foreground">{o.hint}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
