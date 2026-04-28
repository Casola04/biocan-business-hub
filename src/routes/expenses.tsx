import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase, type Expense } from "@/lib/supabase";
import { fmtMoney, formatMonthKey, monthKey, nextId, todayISO } from "@/lib/format";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/expenses")({ component: ExpensesPage });

const CATEGORIES = ["Supplies", "Shipping", "Other"] as const;

type FormState = {
  date: string;
  expense_id: string;
  category: string;
  vendor: string;
  amount: string;
  notes: string;
};

const emptyForm = (suggestedId: string): FormState => ({
  date: todayISO(),
  expense_id: suggestedId,
  category: "Supplies",
  vendor: "",
  amount: "0",
  notes: "",
});

function ExpensesPage() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(""));
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Expense[];
    },
  });

  function suggestExpenseId() {
    const ids = (data ?? []).map((e) => e.expense_id);
    return nextId("EXP", ids);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm(suggestExpenseId()));
    setOpen(true);
  }

  function openEdit(e: Expense) {
    setEditing(e);
    setForm({
      date: e.date,
      expense_id: e.expense_id,
      category: e.category ?? "Supplies",
      vendor: e.vendor ?? "",
      amount: String(e.amount),
      notes: e.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    const amount = Number(form.amount);
    if (isNaN(amount) || amount <= 0) return toast.error("Amount must be > 0");
    if (!form.category) return toast.error("Category required");

    const expense_id = form.expense_id.trim() || suggestExpenseId();
    const payload = {
      expense_id,
      date: form.date,
      category: form.category,
      vendor: form.vendor.trim() || null,
      amount,
      notes: form.notes.trim() || null,
      month_key: monthKey(form.date),
    };

    if (editing) {
      const { error } = await supabase.from("expenses").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success(`Expense ${expense_id} updated`);
    } else {
      const { error } = await supabase.from("expenses").insert(payload);
      if (error) return toast.error(error.message);
      toast.success(`Expense ${expense_id} added`);
    }

    setOpen(false);
    setEditing(null);
    setForm(emptyForm(""));
    qc.invalidateQueries({ queryKey: ["expenses"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("expenses").delete().eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    }
    setConfirmDelete(null);
  }

  const currentMonth = monthKey(new Date());
  const totals = useMemo(() => {
    const all = (data ?? []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const month = (data ?? [])
      .filter((e) => e.month_key === currentMonth)
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { all, month };
  }, [data, currentMonth]);

  return (
    <AppLayout title="Expenses">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground tracking-wide">
            This month ({formatMonthKey(currentMonth)})
          </p>
          <p className="text-2xl font-semibold mt-1">{fmtMoney(totals.month)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase text-muted-foreground tracking-wide">All time</p>
          <p className="text-2xl font-semibold mt-1">{fmtMoney(totals.all)}</p>
        </Card>
      </div>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} expense(s)</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Expense
        </Button>
      </div>

      <Card>
        {error ? (
          <div className="p-6 text-sm text-destructive">
            Error: {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Expense ID</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{e.date}</TableCell>
                  <TableCell className="font-mono text-xs">{e.expense_id}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{e.category}</Badge>
                  </TableCell>
                  <TableCell>{e.vendor ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmtMoney(Number(e.amount))}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {e.notes ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{formatMonthKey(e.month_key)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end items-center gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDelete(e)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    No expenses yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Add/Edit slide-over */}
      <Sheet open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? `Edit ${editing.expense_id}` : "New Expense"}</SheetTitle>
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
                <Label>Expense ID</Label>
                <Input
                  value={form.expense_id}
                  placeholder={suggestExpenseId()}
                  onChange={(e) => setForm({ ...form, expense_id: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(v) => setForm({ ...form, category: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Vendor</Label>
              <Input
                value={form.vendor}
                onChange={(e) => setForm({ ...form, vendor: e.target.value })}
              />
            </div>

            <div>
              <Label>Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>

            <div>
              <Label>Notes (peptide / product name)</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Month: {formatMonthKey(monthKey(form.date))}
            </p>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>
              {editing ? "Save Changes" : "Create Expense"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this expense?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.expense_id} ({fmtMoney(Number(confirmDelete?.amount ?? 0))}){" "}
              will be permanently removed.
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
