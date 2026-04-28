import { createFileRoute } from "@tanstack/react-router";
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
  DollarSign, TrendingDown, TrendingUp, ShoppingCart, AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/")({ component: Dashboard });

type OrderRow = { order_id: string; total: number; month_key: string; product_name: string | null };
type ExpenseRow = { amount: number; month_key: string };
type ProductRow = {
  id: string; product_id: string; name: string; sku: string | null;
  stock_qty: number; reorder_level: number;
};

function Dashboard() {
  const ordersQ = useQuery({
    queryKey: ["dashboard", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("order_id, total, month_key, product_name");
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["dashboard", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("amount, month_key");
      if (error) throw error;
      return (data ?? []) as ExpenseRow[];
    },
  });

  const productsQ = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_id, name, sku, stock_qty, reorder_level");
      if (error) throw error;
      return (data ?? []) as ProductRow[];
    },
  });

  const loading = ordersQ.isLoading || expensesQ.isLoading || productsQ.isLoading;
  const error = ordersQ.error || expensesQ.error || productsQ.error;

  const orders = ordersQ.data ?? [];
  const expenses = expensesQ.data ?? [];
  const products = productsQ.data ?? [];

  const totalRevenue = orders.reduce((s, o) => s + Number(o.total || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const netProfit = totalRevenue - totalExpenses;
  const totalOrders = new Set(orders.map((o) => o.order_id)).size;
  const lowStockItems = products.filter((p) => Number(p.stock_qty) <= Number(p.reorder_level));

  // Monthly grouped data
  const monthMap = new Map<string, { month: string; Revenue: number; Expenses: number }>();
  for (const o of orders) {
    const cur = monthMap.get(o.month_key) ?? { month: o.month_key, Revenue: 0, Expenses: 0 };
    cur.Revenue += Number(o.total || 0);
    monthMap.set(o.month_key, cur);
  }
  for (const e of expenses) {
    const cur = monthMap.get(e.month_key) ?? { month: e.month_key, Revenue: 0, Expenses: 0 };
    cur.Expenses += Number(e.amount || 0);
    monthMap.set(e.month_key, cur);
  }
  const monthlyData = [...monthMap.values()]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => ({
      ...m,
      monthLabel: m.month
        ? new Date(`${m.month.slice(0, 4)}-${m.month.slice(4, 6)}-01`).toLocaleString("en-US", { month: "short", year: "2-digit" })
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

  return (
    <AppLayout title="Dashboard">
      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 mb-6">
          <CardContent className="pt-6 text-sm text-destructive">
            Couldn't load data from Supabase: {(error as Error).message}
          </CardContent>
        </Card>
      ) : null}

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard
          label="Total Revenue"
          value={fmtMoney(totalRevenue)}
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
          label="Net Profit"
          value={fmtMoney(netProfit)}
          icon={TrendingUp}
          loading={loading}
          valueClass={netProfit >= 0 ? "text-success" : "text-destructive"}
        />
        <KpiCard
          label="Total Orders"
          value={totalOrders.toString()}
          icon={ShoppingCart}
          loading={loading}
        />
        <KpiCard
          label="Low Stock Items"
          value={lowStockItems.length.toString()}
          icon={AlertTriangle}
          loading={loading}
          valueClass={lowStockItems.length > 0 ? "text-destructive" : "text-foreground"}
          iconClass={lowStockItems.length > 0 ? "text-destructive" : undefined}
        />
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Revenue vs Expenses</CardTitle>
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
                      formatter={(value: number) => fmtMoney(value)}
                    />
                    <Legend />
                    <Bar dataKey="Revenue" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="var(--destructive)" radius={[4, 4, 0, 0]} />
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
                      formatter={(value: number) => fmtMoney(value)}
                    />
                    <Bar dataKey="Revenue" fill="var(--success)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Low stock table */}
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
