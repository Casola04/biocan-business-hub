import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  // eslint-disable-next-line no-console
  console.warn("Supabase env vars missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
  },
});

export type PricingType = "Standard" | "At Cost";

export type Client = {
  id: string;
  client_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  pricing_type: PricingType | null;
  notes: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  product_id: string;
  name: string;
  sku: string | null;
  unit_cost: number;
  unit_price: number;
  stock_qty: number;
  reorder_level: number;
  notes: string | null;
  created_at: string;
};

export type Order = {
  id: string;
  order_id: string;
  date: string;
  client_id: string | null;
  client_name: string | null;
  product_id: string | null;
  product_name: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  status: string;
  notes: string | null;
  month_key: string;
  created_at: string;
};

export type Expense = {
  id: string;
  expense_id: string;
  date: string;
  category: string;
  vendor: string;
  amount: number;
  notes: string | null;
  month_key: string;
  created_at: string;
};
