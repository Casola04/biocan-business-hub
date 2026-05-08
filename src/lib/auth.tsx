import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type AppRole = "admin" | "employee" | "distributor";

type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isDistributor: boolean;
  splitPct: number; // distributor's profit share (0-100); 70 = 70% to distributor
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [splitPct, setSplitPct] = useState<number>(70);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      if (!s) {
        setRole(null);
        setSplitPct(70);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) return;
    setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("role, split_pct")
        .eq("id", uid)
        .maybeSingle();
      setRole(((data?.role as AppRole) ?? "employee"));
      setSplitPct(Number(data?.split_pct ?? 70));
    }, 0);
  }, [session?.user?.id]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    role,
    loading,
    isAdmin: role === "admin",
    isDistributor: role === "distributor",
    splitPct,
    async signIn(username, password) {
      const uname = username.trim().toLowerCase();
      const { data: emailData, error: lookupErr } = await supabase.rpc(
        "get_email_for_username",
        { p_username: uname },
      );
      if (lookupErr) return { error: lookupErr.message };
      const email = emailData as string | null;
      if (!email) return { error: "Unknown username" };
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message ?? null };
    },
    async signOut() {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
