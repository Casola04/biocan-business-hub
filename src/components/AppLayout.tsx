import type { ReactNode } from "react";
import { useEffect } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon, ShieldCheck, Truck } from "lucide-react";

// Routes that distributors are not allowed to visit. They get bounced to /.
const DISTRIBUTOR_BLOCKED = ["/inventory", "/reports", "/distributors"];

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  const { session, loading, user, role, isAdmin, isDistributor, splitPct, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && !session && location.pathname !== "/login") {
      navigate({ to: "/login" });
    }
  }, [loading, session, location.pathname, navigate]);

  // Distributor route guard — kick them off admin-only pages.
  useEffect(() => {
    if (!loading && isDistributor) {
      const blocked = DISTRIBUTOR_BLOCKED.some((p) =>
        location.pathname === p || location.pathname.startsWith(p + "/"),
      );
      if (blocked) navigate({ to: "/" });
    }
  }, [loading, isDistributor, location.pathname, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3"><div className="h-8 w-8 rounded-full border-2 border-gold/30 border-t-gold animate-spin" /><p className="text-xs tracking-[0.3em] text-muted-foreground">ELORA LABS</p></div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 flex items-center gap-3 border-b bg-card/80 backdrop-blur-md px-4 sm:px-6 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-lg text-foreground flex-1 truncate">{title}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2 rounded-full border border-border bg-background/60 px-3">
                  <UserIcon className="h-4 w-4" />
                  <span className="hidden sm:inline text-sm">{user?.email}</span>
                  {isAdmin && <ShieldCheck className="h-3.5 w-3.5 text-success" />}
                  {isDistributor && <Truck className="h-3.5 w-3.5 text-primary" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium truncate">{user?.email}</span>
                    <span className="text-xs text-muted-foreground capitalize">
                      {role ?? "loading…"}
                      {isDistributor && ` · ${splitPct}% split`}
                    </span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>
          <main className="flex-1 p-4 sm:p-8 overflow-x-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
