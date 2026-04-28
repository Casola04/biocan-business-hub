import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { fmtMoney, monthKey } from "@/lib/format";
import { DollarSign, ShoppingCart, Users, Package, TrendingUp, Receipt } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

function Dashboard() {
  const mk = monthKey(new Date());

  const ordersQ = useQuery({
    queryKey: ["dashboard", "orders", mk],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").eq("month_key", mk);
      if (error) throw error;
      return data ?? [];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["dashboard", "expenses", mk],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").eq("month_key", mk);
      if (error) throw error;
      return data ?? [];
    },
  });

  const clientsQ = useQuery({
    queryKey: ["dashboard", "clients-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("clients").select("*", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const productsQ = useQuery({
    queryKey: ["dashboard", "products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const revenue = (ordersQ.data ?? []).reduce((s, o: any) => s + Number(o.total || 0), 0);
  const expenses = (expensesQ.data ?? []).reduce((s, e: any) => s + Number(e.amount || 0), 0);
  const profit = revenue - expenses;
  const orderCount = ordersQ.data?.length ?? 0;
  const products = productsQ.data ?? [];
  const lowStock = products.filter((p: any) => Number(p.stock_qty) <= Number(p.reorder_level)).length;
  const inventoryValue = products.reduce((s: number, p: any) => s + Number(p.stock_qty) * Number(p.unit_cost), 0);

  const stats = [
    { label: "Revenue (MTD)", value: fmtMoney(revenue), icon: DollarSign, positive: true },
    { label: "Expenses (MTD)", value: fmtMoney(expenses), icon: Receipt },
    { label: "Profit (MTD)", value: fmtMoney(profit), icon: TrendingUp, positive: profit >= 0 },
    { label: "Orders (MTD)", value: orderCount.toString(), icon: ShoppingCart },
    { label: "Clients", value: (clientsQ.data ?? 0).toString(), icon: Users },
    { label: "Inventory Value", value: fmtMoney(inventoryValue), icon: Package },
  ];

  const error = ordersQ.error || expensesQ.error || clientsQ.error || productsQ.error;

  return (
    <AppLayout title="Dashboard">
      {error ? (
        <Card className="border-destructive/40 bg-destructive/5 mb-6">
          <CardContent className="pt-6 text-sm text-destructive">
            Couldn't load data from Supabase. Make sure you've run the table-creation SQL in your Supabase project.
          </CardContent>
        </Card>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${s.positive ? "text-success" : "text-foreground"}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStock === 0 ? (
              <p className="text-sm text-muted-foreground">All products are above reorder level.</p>
            ) : (
              <ul className="space-y-2">
                {products
                  .filter((p: any) => Number(p.stock_qty) <= Number(p.reorder_level))
                  .map((p: any) => (
                    <li key={p.id} className="flex justify-between text-sm">
                      <span>{p.name}</span>
                      <span className="text-destructive font-medium">
                        {p.stock_qty} / {p.reorder_level}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {(ordersQ.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders this month yet.</p>
            ) : (
              <ul className="space-y-2">
                {(ordersQ.data ?? []).slice(0, 5).map((o: any) => (
                  <li key={o.id} className="flex justify-between text-sm">
                    <span className="truncate">
                      {o.order_id} · {o.client_name}
                    </span>
                    <span className="text-success font-medium">{fmtMoney(Number(o.total))}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
