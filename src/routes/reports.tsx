import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";

export const Route = createFileRoute("/reports")({ component: ReportsPage });

function ReportsPage() {
  const ordersQ = useQuery({
    queryKey: ["reports", "orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("month_key, total");
      if (error) throw error;
      return data ?? [];
    },
  });
  const expensesQ = useQuery({
    queryKey: ["reports", "expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("month_key, amount");
      if (error) throw error;
      return data ?? [];
    },
  });

  const months = new Map<string, { revenue: number; expenses: number }>();
  for (const o of ordersQ.data ?? []) {
    const mk = (o as any).month_key as string;
    const cur = months.get(mk) ?? { revenue: 0, expenses: 0 };
    cur.revenue += Number((o as any).total || 0);
    months.set(mk, cur);
  }
  for (const e of expensesQ.data ?? []) {
    const mk = (e as any).month_key as string;
    const cur = months.get(mk) ?? { revenue: 0, expenses: 0 };
    cur.expenses += Number((e as any).amount || 0);
    months.set(mk, cur);
  }
  const rows = [...months.entries()]
    .map(([mk, v]) => ({ mk, ...v, profit: v.revenue - v.expenses }))
    .sort((a, b) => b.mk.localeCompare(a.mk));

  const totalRev = rows.reduce((s, r) => s + r.revenue, 0);
  const totalExp = rows.reduce((s, r) => s + r.expenses, 0);
  const totalProfit = totalRev - totalExp;

  function formatMonth(mk: string) {
    const y = mk.slice(0, 4);
    const m = mk.slice(4, 6);
    return new Date(`${y}-${m}-01`).toLocaleString("en-US", { month: "long", year: "numeric" });
  }

  return (
    <AppLayout title="Reports">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{fmtMoney(totalRev)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{fmtMoney(totalExp)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-muted-foreground">Total Profit</CardTitle></CardHeader>
          <CardContent><div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(totalProfit)}</div></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Monthly Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
                <TableHead className="text-right">Margin</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.mk}>
                  <TableCell className="font-medium">{formatMonth(r.mk)}</TableCell>
                  <TableCell className="text-right text-success">{fmtMoney(r.revenue)}</TableCell>
                  <TableCell className="text-right">{fmtMoney(r.expenses)}</TableCell>
                  <TableCell className={`text-right font-semibold ${r.profit >= 0 ? "text-success" : "text-destructive"}`}>{fmtMoney(r.profit)}</TableCell>
                  <TableCell className="text-right">{r.revenue > 0 ? `${((r.profit / r.revenue) * 100).toFixed(1)}%` : "—"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No data yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </AppLayout>
  );
}
