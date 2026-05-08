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
import logo from "@/assets/true-north-labs-logo.png";
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
      <SidebarHeader className="border-b border-sidebar-border p-2">
        <Link
          to="/"
          className="flex items-center justify-center rounded-md bg-white px-3 py-2 shadow-sm ring-1 ring-black/5 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-1"
        >
          <img
            src={logo}
            alt="True North Labs"
            className="h-8 w-auto object-contain group-data-[collapsible=icon]:hidden"
          />
          <img
            src={logo}
            alt="True North Labs"
            className="hidden h-6 w-6 object-contain group-data-[collapsible=icon]:block"
            style={{ objectPosition: "0 50%" }}
          />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
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
