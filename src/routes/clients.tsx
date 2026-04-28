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
import { supabase, type Client } from "@/lib/supabase";
import { nextId } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/clients")({ component: ClientsPage });

function ClientsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });

  const { data, isLoading, error } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  async function handleCreate() {
    if (!form.name.trim()) return toast.error("Name required");
    const ids = (data ?? []).map((c) => c.client_id);
    const client_id = nextId("CLT", ids);
    const { error } = await supabase.from("clients").insert({
      client_id, name: form.name, email: form.email || null, phone: form.phone || null, notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success(`Client ${client_id} added`);
    setOpen(false);
    setForm({ name: "", email: "", phone: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function handleDelete(id: string) {
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Client deleted");
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <AppLayout title="Clients">
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{data?.length ?? 0} client(s)</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Client</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={handleCreate}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Card>
        {error ? (
          <div className="p-6 text-sm text-destructive">Error loading clients: {(error as Error).message}</div>
        ) : isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading...</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead><TableHead>Name</TableHead><TableHead>Email</TableHead>
                <TableHead>Phone</TableHead><TableHead>Notes</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.client_id}</TableCell>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.email}</TableCell>
                  <TableCell>{c.phone}</TableCell>
                  <TableCell className="max-w-xs truncate">{c.notes}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No clients yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </AppLayout>
  );
}
