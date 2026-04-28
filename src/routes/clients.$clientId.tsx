import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase, type Client, type Order, type PricingType } from "@/lib/supabase";
import { fmtMoney } from "@/lib/format";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/clients/$clientId")({
  component: ClientDetailPage,
});

function ClientDetailPage() {
  const { clientId } = Route.useParams();

  const clientQuery = useQuery({
    queryKey: ["client", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();
      if (error) throw error;
      return data as Client | null;
    },
  });

  const ordersQuery = useQuery({
    queryKey: ["orders", "by-client", clientId],
    enabled: !!clientQuery.data,
    queryFn: async () => {
      const cid = clientQuery.data?.client_id;
      if (!cid) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("client_id", cid)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });

  const totalSpent = (ordersQuery.data ?? []).reduce(
    (s, o) => s + Number(o.total ?? 0),
    0,
  );

  const client = clientQuery.data;

  return (
    <AppLayout title="Client Details">
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clients">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to clients
          </Link>
        </Button>
      </div>

      {clientQuery.isLoading ? (
        <Card><CardContent className="p-6 text-muted-foreground">Loading...</CardContent></Card>
      ) : !client ? (
        <Card><CardContent className="p-6 text-muted-foreground">Client not found.</CardContent></Card>
      ) : (
        <>
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-2xl">{client.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-1">
                    {client.client_id}
                  </p>
                </div>
                <PricingBadge value={(client.pricing_type as PricingType) ?? "Standard"} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 text-sm">
              <Field label="Phone" value={client.phone} />
              <Field label="Email" value={client.email} />
              <Field label="Notes" value={client.notes} className="sm:col-span-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order History</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordersQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Loading orders...
                      </TableCell>
                    </TableRow>
                  ) : (ordersQuery.data ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No orders for this client yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (ordersQuery.data ?? []).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell>{o.date}</TableCell>
                        <TableCell className="font-mono text-xs">{o.order_id}</TableCell>
                        <TableCell>{o.product_name ?? "—"}</TableCell>
                        <TableCell className="text-right">{o.quantity}</TableCell>
                        <TableCell className="text-right">{fmtMoney(Number(o.unit_price))}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmtMoney(Number(o.total))}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <div className="flex justify-end items-center gap-3 px-6 py-4 border-t">
                <span className="text-sm text-muted-foreground">Total spent:</span>
                <span className="text-lg font-semibold text-success">
                  {fmtMoney(totalSpent)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </AppLayout>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="mt-1 whitespace-pre-wrap">{value || "—"}</div>
    </div>
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
