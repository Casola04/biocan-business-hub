import { createFileRoute } from "@tanstack/react-router"; 
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";
import {
  DollarSign, TrendingDown, TrendingUp, ShoppingCart, AlertTriangle, Wallet, Truck,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { applyDistributorScope, useDataScope } from "@/lib/scope";

export const Route = createFileRoute("/")({ component: Dashboard });

type OrderRow = {
  order_id: string;
  total: number;
  month_key: string;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
};
type ExpenseRow = { amount: number; month_key: string };
type ProductRow = {
  id: string; product_id: string; name: string; sku: string | null;
  stock_qty: number; reorder_level: number; unit_cost: number;
};

function Dashboard() {
  const { isDistributor, splitPct } = useAuth();
  const scope = useDataScope();
  // Show split + payout panel whenever we're rendering data for a distributor
  // (their own login OR admin viewing a distributor).
  const showSplit = scope.kind !== "admin";

  const ordersQ = useQuery({
    queryKey: ["dashboard", "orders", scope],
    queryFn: async () => {
      let q = supabase
        .from("orders")
        .select("order_id, total, month_key, product_id, product_name, quantity, unit_price");
      q = applyDistributorScope(q, scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["dashboard", "expenses", scope],
    queryFn: async () => {
      let q = supabase.from("expenses").select("amount, month_key");
      q = applyDistributorScope(q, scope);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });

  // Products are global (not distributor-scoped) — we need unit_cost for profit calc.
  const productsQ = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_id, name, sku, stock_qty, reorder_level, unit_cost");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  // Admin-only: pull every distributor order + expense + their split_pct so we
  // can compute the "House Cut from Distributors" tile.
  const distOrdersQ = useQuery({
    queryKey: ["dashboard", "distOrders"],
    enabled: scope.kind === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("distributor_id, product_id, quantity, unit_price")
        .not("distributor_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const distExpensesQ = useQuery({
    queryKey: ["dashboard", "distExpenses"],
    enabled: scope.kind === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("distributor_id, amount")
        .not("distributor_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });
  const distProfilesQ = useQuery({
    queryKey: ["dashboard", "distProfiles"],
    enabled: scope.kind === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, split_pct")
        .eq("role", "distributor");
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = ordersQ.isLoading || expensesQ.isLoading || productsQ.isLoading;
  const error = ordersQ.error || expensesQ.error || productsQ.error;

  const orders = ordersQ.data ?? [];
  const expenses = expensesQ.data ?? [];
  const products = productsQ.data ?? [];
  const productById = new Map(products.map((p) => [p.id, p]));

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalOrders = new Set(orders.map((o) => o.order_id)).size;

  // Per-order gross profit = (sale price - cost) * qty
  const grossProfit = orders.reduce((s, o) => {
    const cost = productById.get(o.product_id ?? "")?.unit_cost ?? 0;
    return s + (Number(o.unit_price) - Number(cost)) * Number(o.quantity);
  }, 0);
  // Net profit = gross profit MINUS distributor's own expenses.
  // The 70/30 split is calculated against this net number.
  const netProfitForSplit = grossProfit - totalExpenses;
  const distributorTake = netProfitForSplit * (splitPct / 100);
  const houseTake = netProfitForSplit - distributorTake;

  // Admin-only: total 30% (or whatever each distributor's split is) we earn
  // off ALL distributor activity. Calculated per-distributor because each
  // person can have a different split %.
  const houseCutFromDistributors = useMemo(() => {
    if (scope.kind !== "admin") return 0;
    const distOrders = distOrdersQ.data ?? [];
    const distExpenses = distExpensesQ.data ?? [];
    const distProfiles = distProfilesQ.data ?? [];

    let total = 0;
    for (const p of distProfiles as Array<{ id: string; split_pct: number }>) {
      const myOrders = distOrders.filter((o: any) => o.distributor_id === p.id);
      const myExpenses = distExpenses.filter((e: any) => e.distributor_id === p.id);
      const grossP = myOrders.reduce((s: number, o: any) => {
        const cost = productById.get(o.product_id ?? "")?.unit_cost ?? 0;
        return s + (Number(o.unit_price) - Number(cost)) * Number(o.quantity);
      }, 0);
      const expSum = myExpenses.reduce((s: number, e: any) => s + Number(e.amount || 0), 0);
      const netP = grossP - expSum;
      const houseShare = 1 - Number(p.split_pct ?? 70) / 100;
      total += netP * houseShare;
    }
    return total;
  }, [scope.kind, distOrdersQ.data, distExpensesQ.data, distProfilesQ.data, productById]);

  const lowStockItems = products.filter((p) => Number(p.stock_qty) <= Number(p.reorder_level));

  // Monthly grouped data
  const monthMap = new Map<string, { month: string; Revenue: number; Expenses: number; Profit: number }>();
  for (const o of orders) {
    const cur = monthMap.get(o.month_key) ?? { month: o.month_key, Revenue: 0, Expenses: 0, Profit: 0 };
    cur.Revenue += Number(o.total || 0);
    const cost = productById.get(o.product_id ?? "")?.unit_cost ?? 0;
    cur.Profit += (Number(o.unit_price) - Number(cost)) * Number(o.quantity);
    monthMap.set(o.month_key, cur);
  }
  for (const e of expenses) {
    const cur = monthMap.get(e.month_key) ?? { month: e.month_key, Revenue: 0, Expenses: 0, Profit: 0 };
    cur.Expenses += Number(e.amount || 0);
    monthMap.set(e.month_key, cur);
  }
  const monthlyData = [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      monthLabel: m.month && m.month.length === 6
        ? new Date(
            parseInt(m.month.slice(0, 4), 10),
            parseInt(m.month.slice(4, 6), 10) - 1,
            1,
          ).toLocaleString("en-US", { month: "short", year: "2-digit" })
        : "—",
    }));

  // Revenue by product
  const productRevMap = new Map<string, number>();
  for (const o of orders) {
    const k = o.product_name ?? "Unknown";
    productRevMap.set(k, (productRevMap.get(k) ?? 0) + Number(o.total || 0));
  }
  const productRevData = [...productRevMap.entries()]
    .map(([name, Revenue]) => ({ name, Revenue }))
    .sort((a, b) => b.Revenue - a.Revenue)
    .slice(0, 10);

  const title = scope.kind === "distributor"
    ? "Distributor View"
    : isDistributor ? "My Dashboard" : "Dashboard";

  return (
    <AppLayout title={title}>
      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 mb-6">
          <CardContent className="pt-6 text-sm text-destructive">
            Couldn't load data from Supabase: {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard
          label="Total Revenue"
          value={fmtMoney(scope.kind === "admin" ? totalRevenue + houseCutFromDistributors : totalRevenue)}
          icon={DollarSign}
          loading={loading}
          valueClass="text-success"
        />
        <KpiCard
          label="Total Expenses"
          value={fmtMoney(totalExpenses)}
          icon={TrendingDown}
          loading={loading}
          valueClass="text-destructive"
        />
        <KpiCard
          label={showSplit ? "Net Profit (after exp.)" : "Net Profit"}
          value={fmtMoney(showSplit ? netProfitForSplit : (totalRevenue + houseCutFromDistributors) - totalExpenses)}
          icon={TrendingUp}
          loading={loading}
          valueClass={(showSplit ? netProfitForSplit : netProfit) >= 0 ? "text-success" : "text-destructive"}
        />
        <KpiCard
          label="Total Orders"
          value={totalOrders.toString()}
          icon={ShoppingCart}
          loading={loading}
        />
        {showSplit ? (
          <KpiCard
            label={`Your Take (${splitPct}%)`}
            value={fmtMoney(distributorTake)}
            icon={Wallet}
            loading={loading}
            valueClass="text-success"
          />
        ) : (
          <>
            <KpiCard
              label="House Cut (Distributors)"
              value={fmtMoney(houseCutFromDistributors)}
              icon={Truck}
              loading={loading || distOrdersQ.isLoading}
              valueClass="text-success"
            />
            <KpiCard
              label="Low Stock Items"
              value={lowStockItems.length.toString()}
              icon={AlertTriangle}
              loading={loading}
              valueClass={lowStockItems.length > 0 ? "text-destructive" : "text-foreground"}
              iconClass={lowStockItems.length > 0 ? "text-destructive" : undefined}
            />
          </>
        )}
      </div>

      {/* Profit-split breakdown card (distributor view) */}
      {showSplit && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">
              Profit Split ({splitPct}% / {100 - splitPct}%)
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Calculated on net profit (revenue − cost of goods − your expenses).
            </p>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <SplitTile label="Gross Profit" value={fmtMoney(grossProfit)} className="text-foreground" />
            <SplitTile label="Net Profit" value={fmtMoney(netProfitForSplit)} className="text-foreground" />
            <SplitTile label={`Your Cut (${splitPct}%)`} value={fmtMoney(distributorTake)} className="text-success" />
            <SplitTile label={`House Cut (${100 - splitPct}%)`} value={fmtMoney(houseTake)} className="text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {showSplit ? "Monthly Revenue vs Profit" : "Monthly Revenue vs Expenses"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : monthlyData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No data yet.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="monthLabel" stroke="var(--muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={((value: unknown) => fmtMoney(Number(value))) as any}
                    />
                    <Legend />
                    <Bar dataKey="Revenue" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar
                      dataKey={showSplit ? "Profit" : "Expenses"}
                      fill={showSplit ? "hsl(220 90% 56%)" : "var(--destructive)"}
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revenue by Product</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : productRevData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-12 text-center">No data yet.</p>
            ) : (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={productRevData}
                    layout="vertical"
                    margin={{ left: 20, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickFormatter={(v) => `$${v}`} />
                    <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} width={100} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "0.5rem",
                        color: "var(--popover-foreground)",
                      }}
                      formatter={((value: unknown) => fmtMoney(Number(value))) as any}
                    />
                    <Bar dataKey="Revenue" fill="var(--success)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock table — admin only */}
      {!showSplit && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6"><Skeleton className="h-32 w-full" /></div>
            ) : lowStockItems.length === 0 ? (
              <p className="text-sm text-muted-foreground p-6 text-center">All products are above reorder level.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reorder Level</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{p.stock_qty}</TableCell>
                      <TableCell className="text-right">{p.reorder_level}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline">Restock</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </AppLayout>
  );
}

function KpiCard({
  label, value, icon: Icon, loading, valueClass, iconClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
  valueClass?: string;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </CardTitle>
        <Icon className={`h-4 w-4 ${iconClass ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className={`text-2xl font-bold ${valueClass ?? "text-foreground"}`}>{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function SplitTile({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-4 py-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${className ?? ""}`}>{value}</p>
    </div>
  );
}
