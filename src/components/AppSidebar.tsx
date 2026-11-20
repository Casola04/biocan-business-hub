import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Receipt,
  BarChart3,
  Truck,
} from "lucide-react";
import logo from "@/assets/elora-logo-light.png";
import mark from "@/assets/elora-mark-light.png";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";

type NavItem = { title: string; url: string; icon: typeof LayoutDashboard };

const adminItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Expenses", url: "/expenses", icon: Receipt },
  { title: "Reports", url: "/reports", icon: BarChart3 },
  { title: "Distributors", url: "/distributors", icon: Truck },
];

// Distributors get a stripped-down menu — no inventory, no reports,
// no distributors-management page.
const distributorItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "My Clients", url: "/clients", icon: Users },
  { title: "My Orders", url: "/orders", icon: ShoppingCart },
  { title: "My Expenses", url: "/expenses", icon: Receipt },
];

export function AppSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;
  const { isDistributor } = useAuth();
  const items = isDistributor ? distributorItems : adminItems;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 pt-6 pb-5 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-3">
        <Link to="/" className="flex flex-col items-center justify-center gap-2">
          <img
            src={logo}
            alt="Elora Labs"
            className="h-[74px] w-auto object-contain group-data-[collapsible=icon]:hidden"
          />
          <span className="text-[10px] tracking-[0.34em] text-sidebar-primary/80 group-data-[collapsible=icon]:hidden">
            OPERATING SYSTEM
          </span>
          <img
            src={mark}
            alt="Elora Labs"
            className="hidden h-7 w-7 object-contain group-data-[collapsible=icon]:block"
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] tracking-[0.28em] uppercase text-sidebar-foreground/50">Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const isActive = currentPath === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      className="h-10 rounded-xl text-[13.5px] tracking-wide text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[active=true]:bg-gradient-to-r data-[active=true]:from-[#2f2820] data-[active=true]:to-[#241f19] data-[active=true]:text-[#f4ede2] data-[active=true]:shadow-[inset_2px_0_0_#c9a96e] [&>svg]:size-[18px] data-[active=true]:[&>svg]:text-[#c9a96e]"
                    >
                      <Link to={item.url}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
