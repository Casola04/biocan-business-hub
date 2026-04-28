import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

export function AppLayout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b bg-card px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-base font-semibold text-foreground">{title}</h1>
          </header>
          <main className="flex-1 p-6 overflow-x-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
