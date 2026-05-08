import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { supabase, type Profile } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Pencil, ChevronRight } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/distributors/")({ component: DistributorsList });

type DistributorRow = Profile & {
  revenue: number;
  profit: number;
  their_cut: number;
  order_count: number;
};

function DistributorsList() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // 1. distributors (profiles where role = 'distributor')
  const distQ = useQuery({
    queryKey: ["distributors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, role, split_pct")
        .eq("role", "distributor")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
    enabled: isAdmin,
  });

  // 2. all orders (admin can see everything; we aggregate per distributor)
  const ordersQ = useQuery({
    queryKey: ["distributors", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("distributor_id, total, quantity, unit_price, product_id");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  // 3. products for unit_cost lookup
  const productsQ = useQuery({
    queryKey: ["distributors", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, unit_cost");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isAdmin,
  });

  const rows: DistributorRow[] = useMemo(() => {
    const dists = distQ.data ?? [];
    const orders = ordersQ.data ?? [];
    const costMap = new Map<string, number>(
      (productsQ.data ?? []).map((p: any) => [p.id, Number(p.unit_cost ?? 0)]),
    );

    return dists.map((d) => {
      const myOrders = orders.filter((o: any) => o.distributor_id === d.id);
      const revenue = myOrders.reduce((s, o: any) => s + Number(o.total || 0), 0);
      const profit = myOrders.reduce((s, o: any) => {
        const cost = costMap.get(o.product_id ?? "") ?? 0;
        return s + (Number(o.unit_price) - cost) * Number(o.quantity);
      }, 0);
      return {
        ...d,
        revenue,
        profit,
        their_cut: profit * (Number(d.split_pct ?? 70) / 100),
        order_count: myOrders.length,
      };
    });
  }, [distQ.data, ordersQ.data, productsQ.data]);

  // Edit-split sheet
  const [editing, setEditing] = useState<Profile | null>(null);
  const [splitInput, setSplitInput] = useState<string>("70");

  function openEdit(d: Profile) {
    setEditing(d);
    setSplitInput(String(d.split_pct ?? 70));
  }

  async function handleSaveSplit() {
    if (!editing) return;
    const v = Number(splitInput);
    if (isNaN(v) || v < 0 || v > 100) {
      toast.error("Split must be between 0 and 100");
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ split_pct: v })
      .eq("id", editing.id);
    if (error) return toast.error(error.message);
    toast.success(`${editing.full_name ?? editing.username}'s split updated to ${v}%`);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["distributors"] });
  }

  if (!isAdmin) {
    return (
      <AppLayout title="Distributors">
        <Card className="p-6 text-sm text-muted-foreground">
          Admin access required.
        </Card>
      </AppLayout>
    );
  }

  const loading = distQ.isLoading || ordersQ.isLoading || productsQ.isLoading;

  return (
    <AppLayout title="Distributors">
      <Card className="mb-4 p-4 text-sm text-muted-foreground">
        Each distributor below logs in with their own credentials and only sees
        their own clients, orders, and expenses. Click a row to view their data.
        Click the pencil to change their profit-split percentage.
      </Card>

      <Card>
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground text-center">
            No distributors yet. Add one in Supabase → Authentication → Users,
            then run the snippet in <code>db/02-add-distributor.sql</code>.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="text-right">Split</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Their Cut</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate({
                      to: "/distributors/$distributorId",
                      params: { distributorId: d.id },
                    })
                  }
                >
                  <TableCell className="font-medium">{d.full_name ?? "—"}</TableCell>
                  <TableCell>{d.username ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{d.email ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline">{d.split_pct}%</Badge>
                  </TableCell>
                  <TableCell className="text-right">{d.order_count}</TableCell>
                  <TableCell className="text-right text-success">
                    {fmtMoney(d.revenue)}
                  </TableCell>
                  <TableCell className="text-right">{fmtMoney(d.profit)}</TableCell>
                  <TableCell className="text-right text-success font-semibold">
                    {fmtMoney(d.their_cut)}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 inline text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <SheetContent className="sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>
              Edit split — {editing?.full_name ?? editing?.username}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 py-4">
            <div>
              <Label>Split percentage (0–100)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={splitInput}
                onChange={(e) => setSplitInput(e.target.value)}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {splitInput || 0}% of profit to distributor, {100 - Number(splitInput || 0)}% to house.
              </p>
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={handleSaveSplit}>Save</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
