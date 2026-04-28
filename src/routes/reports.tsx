import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend,
} from "recharts";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { fmtMoney, formatMonthKey } from "@/lib/format";
import { Download } from "lucide-react";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ReportsPage() {
  const ordersQ = useQuery({
    queryKey: ["reports", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, product_id, product_name, quantity, unit_price, total, month_key, date");
      if (error) throw error;
      return data ?? [];
    },
  });

  const expensesQ = useQuery({
    queryKey: ["reports", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("month_key, amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  // ---------- Revenue by Product ----------
  const productRows = useMemo(() => {
    const map = new Map<string, { name: string; revenue: number; orders: number }>();
    for (const o of (ordersQ.data ?? []) as any[]) {
      const key = o.product_name ?? "Unknown";
      const cur = map.get(key) ?? { name: key, revenue: 0, orders: 0 };
      cur.revenue += Number(o.total || 0);
      cur.orders += 1;
      map.set(key, cur);
    }
    return [...map.values()]
      .map((r) => ({ ...r, avg: r.orders > 0 ? r.revenue / r.orders : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [ordersQ.data]);

  // ---------- Monthly P&L ----------
  const monthlyRows = useMemo(() => {
    const map = new Map<string, { revenue: number; expenses: number }>();
    for (const o of (ordersQ.data ?? []) as any[]) {
      if (!o.month_key) continue;
      const cur = map.get(o.month_key) ?? { revenue: 0, expenses: 0 };
      cur.revenue += Number(o.total || 0);
      map.set(o.month_key, cur);
    }
    for (const e of (expensesQ.data ?? []) as any[]) {
      if (!e.month_key) continue;
      const cur = map.get(e.month_key) ?? { revenue: 0, expenses: 0 };
      cur.expenses += Number(e.amount || 0);
      map.set(e.month_key, cur);
    }
    return [...map.entries()]
      .map(([mk, v]) => ({
        mk,
        label: formatMonthKey(mk) ?? mk,
        revenue: v.revenue,
        expenses: v.expenses,
        profit: v.revenue - v.expenses,
        margin: v.revenue > 0 ? ((v.revenue - v.expenses) / v.revenue) * 100 : 0,
      }))
      .filter((r) => r.revenue !== 0 || r.expenses !== 0)
      .sort((a, b) => a.mk.localeCompare(b.mk));
  }, [ordersQ.data, expensesQ.data]);

  const monthlyDesc = useMemo(() => [...monthlyRows].reverse(), [monthlyRows]);

  function exportProductCSV() {
    downloadCSV(
      "revenue-by-product.csv",
      ["Product Name", "Total Revenue", "# of Orders", "Avg Order Value"],
      productRows.map((r) => [r.name, r.revenue.toFixed(2), r.orders, r.avg.toFixed(2)]),
    );
  }

  function exportMonthlyCSV() {
    downloadCSV(
      "monthly-pl.csv",
      ["Month", "Revenue", "Expenses", "Net Profit", "Profit Margin %"],
      monthlyDesc.map((r) => [
        r.label,
        r.revenue.toFixed(2),
        r.expenses.toFixed(2),
        r.profit.toFixed(2),
        r.margin.toFixed(1),
      ]),
    );
  }

  const isLoading = ordersQ.isLoading || expensesQ.isLoading;

  return (
    <AppLayout title="Reports">
      {/* Section 1: Revenue by Product */}
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Revenue by Product</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportProductCSV}
            disabled={productRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : productRows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No order data yet
            </div>
          ) : (
            <>
              <div style={{ width: "100%", height: Math.max(220, productRows.length * 36 + 60) }}>
                <ResponsiveContainer>
                  <BarChart
                    data={productRows}
                    layout="vertical"
                    margin={{ top: 10, right: 24, left: 16, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => fmtMoney(Number(v))}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtMoney(Number(v))}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right"># of Orders</TableHead>
                    <TableHead className="text-right">Avg Order Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productRows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right text-success font-semibold">
                        {fmtMoney(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right">{r.orders}</TableCell>
                      <TableCell className="text-right">{fmtMoney(r.avg)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Monthly P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Monthly P&amp;L Summary</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={exportMonthlyCSV}
            disabled={monthlyRows.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : monthlyRows.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              No data yet
            </div>
          ) : (
            <>
              <div style={{ width: "100%", height: 320 }}>
                <ResponsiveContainer>
                  <LineChart
                    data={monthlyRows}
                    margin={{ top: 10, right: 24, left: 8, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis
                      tickFormatter={(v) => fmtMoney(Number(v))}
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <Tooltip
                      formatter={(v: number) => fmtMoney(Number(v))}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Revenue"
                      stroke="hsl(142 70% 45%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Expenses"
                      stroke="hsl(0 75% 55%)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Net Profit</TableHead>
                    <TableHead className="text-right">Profit Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {monthlyDesc.map((r) => (
                    <TableRow key={r.mk}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-right text-success">
                        {fmtMoney(r.revenue)}
                      </TableCell>
                      <TableCell className="text-right">{fmtMoney(r.expenses)}</TableCell>
                      <TableCell
                        className={`text-right font-semibold ${
                          r.profit >= 0 ? "text-success" : "text-destructive"
                        }`}
                      >
                        {fmtMoney(r.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.revenue > 0 ? `${r.margin.toFixed(1)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </CardContent>
      </Card>
    </AppLayout>
  );
}
