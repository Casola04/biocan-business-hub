import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase, type Profile, type Order } from "@/lib/supabase";
import { fmtMoney, formatMonthKey } from "@/lib/format";
import {
  ArrowLeft, DollarSign, TrendingUp, ShoppingCart, Wallet, Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

// Read-only admin view of a single distributor's data.
// Uses the same scope-aware filtering: useDataScope() detects the
// :distributorId param and other pages would already filter by it,
// but this page does its own queries for compactness.
export const Route = createFileRoute("/distributors/$distributorId")({
  component: DistributorDetail,
});

function DistributorDetail() {
  const { distributorId } = Route.useParams();
  const { isAdmin } = useAuth();

  const profileQ = useQuery({
    queryKey: ["distributor", distributorId],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, email, role, split_pct")
        .eq("id", distributorId)
        .maybeSingle();
      if (error) throw error;
      return data as Profile | null;
    },
  });

  const ordersQ = useQuery({
    queryKey: ["distributor", distributorId, "orders"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("distributor_id", distributorId)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["distributor", distributorId, "expenses"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount")
        .eq("distributor_id", distributorId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["distributor", distributorId, "clients"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id")
        .eq("distributor_id", distributorId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const productsQ = useQuery({
    queryKey: ["dashboard", "products"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, unit_cost");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const orders = ordersQ.data ?? [];
    const costMap = new Map<string, number>(
      (productsQ.data ?? []).map((p: any) => [p.id, Number(p.unit_cost ?? 0)]),
    );
    const revenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const profit = orders.reduce((s, o) => {
      const cost = costMap.get(o.product_id ?? "") ?? 0;
      return s + (Number(o.unit_price) - cost) * Number(o.quantity);
    }, 0);
    const expenseTotal = (expensesQ.data ?? []).reduce(
      (s: number, e: any) => s + Number(e.amount || 0),
      0,
    );
    const splitPct = Number(profileQ.data?.split_pct ?? 70);
    return {
      revenue,
      profit,
      net: revenue - expenseTotal,
      expenses: expenseTotal,
      splitPct,
      theirCut: profit * (splitPct / 100),
      houseCut: profit * (1 - splitPct / 100),
      orderCount: orders.length,
      clientCount: (clientsQ.data ?? []).length,
    };
  }, [ordersQ.data, expensesQ.data, productsQ.data, clientsQ.data, profileQ.data]);

  if (!isAdmin) {
    return (
      <AppLayout title="Distributor">
        <Card className="p-6 text-sm text-muted-foreground">
          Admin access required.
        </Card>
      </AppLayout>
    );
  }

  const profile = profileQ.data;

  return (
    <AppLayout title={profile?.full_name ?? profile?.username ?? "Distributor"}>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/distributors">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to distributors
          </Link>
        </Button>
      </div>

      {profileQ.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">Loading…</CardContent></Card>
      ) : !profile ? (
        <Card><CardContent className="p-6 text-muted-foreground">Distributor not found.</CardContent></Card>
      ) : (
        <>
          {/* Profile card */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{profile.full_name ?? profile.username}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {profile.username} · {profile.email ?? "—"}
                  </p>
                </div>
                <Badge variant="outline">Split: {profile.split_pct}%</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* KPI tiles */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <Kpi label="Clients" value={String(totals.clientCount)} icon={Users} />
            <Kpi label="Orders" value={String(totals.orderCount)} icon={ShoppingCart} />
            <Kpi label="Revenue" value={fmtMoney(totals.revenue)} icon={DollarSign} valueClass="text-success" />
            <Kpi label="Gross Profit" value={fmtMoney(totals.profit)} icon={TrendingUp} />
            <Kpi
              label={`Their Cut (${totals.splitPct}%)`}
              value={fmtMoney(totals.theirCut)}
              icon={Wallet}
              valueClass="text-success"
            />
            <Kpi
              label={`House Cut (${100 - totals.splitPct}%)`}
              value={fmtMoney(totals.houseCut)}
              icon={Wallet}
            />
          </div>

          {/* Recent orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Their Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {ordersQ.isLoading ? (
                <div className="p-6 text-sm text-muted-foreground">Loading orders…</div>
              ) : (ordersQ.data ?? []).length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">No orders yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead>Month</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ordersQ.data ?? []).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.date}</TableCell>
                        <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                        <TableCell>{o.client_name ?? "—"}</TableCell>
                        <TableCell>{o.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right">{o.quantity}</TableCell>
                        <TableCell className="text-right text-success font-semibold">
                          {fmtMoney(Number(o.total))}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{formatMonthKey(o.month_key)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}

function Kpi({
  label, value, icon: Icon, valueClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-xl font-bold ${valueClass ?? "text-foreground"}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
