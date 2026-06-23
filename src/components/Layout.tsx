import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, PackagePlus, DollarSign, Users, HardDrive } from "lucide-react";

const navItems = [
  { to: "/dashboard", label: "Início", icon: LayoutDashboard },
  { to: "/estoque", label: "Estoque", icon: Package },
  { to: "/reposicao", label: "Reposição", icon: PackagePlus },
  { to: "/financeiro", label: "Financeiro", icon: DollarSign },
  { to: "/fiado", label: "Fiado", icon: Users },
  { to: "/backup", label: "Backup", icon: HardDrive },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <aside className="w-56 bg-sidebar text-sidebar-foreground flex flex-col">
        <div className="p-4 border-b border-sidebar-border">
          <img
            src="/logo-light.png"
            alt="Ricardo Pneus Autocenter"
            className="w-full h-auto dark:hidden"
          />
          <img
            src="/logo-dark.png"
            alt="Ricardo Pneus Autocenter"
            className="w-full h-auto hidden dark:block"
          />
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50"
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 text-xs text-sidebar-foreground/50">
          v0.1.0
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 bg-background">
        {children}
      </main>
    </div>
  );
}
