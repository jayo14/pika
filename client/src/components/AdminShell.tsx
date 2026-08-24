import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeftRight, LayoutDashboard, MoreHorizontal, Radar, ShieldCheck, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

function Brand() { return <Link className="pika-dash-brand" href="/"><span className="pika-mark" aria-hidden="true" /><span>Pika</span></Link>; }

export type AdminNavKey = "overview" | "users" | "workspaces" | "system";

const NAV_ITEMS: { id: AdminNavKey; label: string; icon: typeof LayoutDashboard; href: string }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/admin" },
  { id: "users", label: "Users", icon: Users, href: "/admin/users" },
  { id: "workspaces", label: "Workspaces", icon: Radar, href: "/admin/workspaces" },
  { id: "system", label: "System", icon: ShieldCheck, href: "/admin/system" },
];

export function AdminShell({ active, title, subtitle, children }: { active: AdminNavKey; title: string; subtitle?: string; children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const initial = (user?.display_name || user?.email || "?").charAt(0).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    setLocation("/sign-in");
  };

  return (
    <main className="pika-dash-page">
      <div className="pika-dash-orbit orbit-one" />
      <div className="pika-dash-orbit orbit-two" />
      <div className={`pika-dash-shell ${sidebarExpanded ? "sidebar-expanded" : ""}`}>
        <aside className={`pika-dash-sidebar ${menuOpen ? "is-open" : ""} ${sidebarExpanded ? "is-expanded" : ""}`}>
          <div>
            <div className="pika-dash-side-head">
              <Brand />
              <button className="pika-dash-close" aria-label="Close admin menu" onClick={() => setMenuOpen(false)}><X size={18} /></button>
            </div>
            <span className="pika-admin-badge">Admin console</span>
            <span className="pika-dash-side-label">Server</span>
            <nav aria-label="Admin navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return <Link key={item.id} href={item.href} className={active === item.id ? "is-active" : ""}><Icon size={17} /><span>{item.label}</span></Link>;
              })}
            </nav>
            <span className="pika-dash-side-label side-label-lower">Workspace</span>
            <Link href="/dashboard" className="pika-dash-side-tool"><ArrowLeftRight size={17} />Back to workspace</Link>
          </div>
          <div className="pika-dash-profile">
            <button type="button" onClick={handleSignOut}>
              <span className="pika-dash-initial initial-a">{initial}</span>
              <span><b>{user?.display_name || user?.email}</b><small>Sign out</small></span>
              <MoreHorizontal size={17} />
            </button>
          </div>
        </aside>
        <div className="pika-dash-backdrop" onClick={() => setMenuOpen(false)} />
        <section className="pika-dash-main">
          <header className="pika-dash-topbar">
            <div><h1>{title}</h1></div>
            <div className="pika-dash-account">
              <span className="pika-dash-avatar">{initial}</span>
              <span><b>{user?.display_name || user?.email}</b><small>Staff</small></span>
            </div>
          </header>
          <div className="pika-dash-content">
            {subtitle && <p className="pika-admin-subtitle">{subtitle}</p>}
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
