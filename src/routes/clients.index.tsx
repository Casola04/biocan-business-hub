import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { supabase, type Client, type PricingType } from "@/lib/supabase";
import { nextId } from "@/lib/format";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { applyDistributorScope, distributorIdForInsert, useDataScope } from "@/lib/scope";

export const Route = createFileRoute("/clients/")({ component: ClientsListPage });

type FormState = {
  name: string;
  email: string;
  phone: string;
  pricing_type: PricingType;
  notes: string;
};

const emptyForm: FormState = {
  name: "",
  email: "",
  phone: "",
  pricing_type: "Standard",
  notes: "",
};

function ClientsListPage() {
  const { isAdmin, isDistributor } = useAuth();
  const scope = useDataScope();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Client | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["clients", scope],
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });
      q = applyDistributorScope(q, scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data ?? [];
    return (data ?? []).filter((c) =>
      [c.name, c.email, c.phone, c.notes, c.client_id]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [data, search]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }

  function openEdit(c: Client) {
    setEditing(c);
    setForm({
      name: c.name,
      email: c.email ?? "",
      phone: c.phone ?? "",
      pricing_type: (c.pricing_type as PricingType) ?? "Standard",
      notes: c.notes ?? "",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      pricing_type: form.pricing_type,
      notes: form.notes.trim() || null,
    };

    if (editing) {
      const { error } = await supabase.from("clients").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Client updated");
    } else {
      const ids = (data ?? []).map((c) => c.client_id);
      const client_id = nextId("CLT", ids);
      const { error } = await supabase.from("clients").insert({
        client_id,
        ...payload,
        distributor_id: distributorIdForInsert(scope),
      });
      if (error) return toast.error(error.message);
      toast.success(`Client ${client_id} added`);
    }

    setOpen(false);
    setEditing(null);
    setForm(emptyForm);
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    const { error } = await supabase.from("clients").delete().eq("id", confirmDelete.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Client deleted");
      qc.invalidateQueries({ queryKey: ["clients"] });
    }
    setConfirmDelete(null);
  }

  return (
    <AppLayout title="Clients">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </Button>
      </div>

      <Card>
        {error ? (
          <div className="p-6 text-sm text-destructive">
            Error loading clients: {(error as Error).message}
          </div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Pricing Type</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({ to: "/clients/$clientId", params: { clientId: c.id } })
                  }
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.phone ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>
                    <PricingBadge value={(c.pricing_type as PricingType) ?? "Standard"} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {c.notes ?? "—"}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(isAdmin || isDistributor) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmDelete(c)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {search ? "No clients match your search." : "No clients yet"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editing ? "Edit Client" : "New Client"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Pricing Type</Label>
              <Select
                value={form.pricing_type}
                onValueChange={(v) =>
                  setForm({ ...form, pricing_type: v as PricingType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Standard">Standard</SelectItem>
                  <SelectItem value="At Cost">At Cost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={4}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{editing ? "Save Changes" : "Create"}</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this client?</AlertDialogTitle>
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

function PricingBadge({ value }: { value: PricingType }) {
  if (value === "At Cost") {
    return (
      <Badge className="bg-orange-500/15 text-orange-600 hover:bg-orange-500/20 border-orange-500/30">
        At Cost
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-500/15 text-blue-600 hover:bg-blue-500/20 border-blue-500/30">
      Standard
    </Badge>
  );
}
