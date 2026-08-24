import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Bell, BookOpen, Bookmark, ChevronDown, CircleHelp, LayoutDashboard, Menu, MoreHorizontal, Radar, Settings, ShieldCheck, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

function Brand() { return <Link className="pika-dash-brand" href="/"><span className="pika-mark" aria-hidden="true" /><span>Pika</span></Link>; }

export type AppNavKey = "dashboard" | "monitors" | "saved" | "settings" | "admin";

const NAV_ITEMS: { id: AppNavKey; label: string; icon: typeof LayoutDashboard; href: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { id: "monitors", label: "Monitors", icon: Radar, href: "/monitors" },
  { id: "saved", label: "Saved", icon: Bookmark, href: "/saved" },
];

export function AppShell({ active, title, headerRight, children }: { active: AppNavKey; title: string; headerRight?: React.ReactNode; children: React.ReactNode }) {
  const { user, workspaces, activeWorkspaceId, setActiveWorkspaceId, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0];
  const initial = (user?.display_name || user?.email || "?").charAt(0).toUpperCase();

  const unreadQuery = useQuery({
    queryKey: ["notifications", activeWorkspaceId, "unread-count"],
    queryFn: () => api.notifications.list(activeWorkspaceId as string, true),
    enabled: Boolean(activeWorkspaceId),
    refetchInterval: 60_000,
  });
  const unreadCount = unreadQuery.data?.length ?? 0;

  const toggleSidebar = () => {
    if (window.innerWidth <= 900) setMenuOpen(true);
    else setSidebarExpanded((expanded) => !expanded);
  };

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
              <button className="pika-dash-close" aria-label="Close workspace menu" onClick={() => setMenuOpen(false)}><X size={18} /></button>
            </div>
            {workspaces.length > 0 && (
              <label className="pika-dash-workspace" aria-label="Active workspace">
                <span className="pika-dash-initial">{(activeWorkspace?.name ?? "P").charAt(0).toUpperCase()}</span>
                <span>
                  <b>{activeWorkspace?.name ?? "Workspace"}</b>
                  <select value={activeWorkspaceId ?? ""} onChange={(event) => setActiveWorkspaceId(event.target.value)}>
                    {workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                  </select>
                </span>
                <ChevronDown size={15} />
              </label>
            )}
            <span className="pika-dash-side-label">Workspace</span>
            <nav aria-label="Workspace navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return <Link key={item.id} href={item.href} className={active === item.id ? "is-active" : ""}><Icon size={17} /><span>{item.label}</span></Link>;
              })}
              <Link href="/blog-articles"><BookOpen size={17} /><span>Guides</span></Link>
            </nav>
            <span className="pika-dash-side-label side-label-lower">Workspace tools</span>
            {user?.is_staff && <Link href="/admin" className={`pika-dash-side-tool ${active === "admin" ? "is-active" : ""}`}><ShieldCheck size={17} />Admin</Link>}
            <a className="pika-dash-side-tool" href="mailto:support@pika.app"><CircleHelp size={17} />Help & support</a>
          </div>
          <div className="pika-dash-profile">
            <Link href="/settings"><Settings size={17} />Settings</Link>
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
            <div>
              <button className="pika-dash-menu" aria-label="Toggle workspace navigation" aria-pressed={sidebarExpanded} onClick={toggleSidebar}><Menu size={20} /></button>
              <h1>{title}</h1>
            </div>
            <div className="pika-dash-account">
              {headerRight ?? (
                <>
                  <span className="pika-dash-avatar">{initial}</span>
                  <span><b>{user?.display_name || user?.email}</b><small>{activeWorkspace?.name ?? "Workspace"}</small></span>
                  <Link href="/dashboard" className="pika-notification-bell" aria-label={`${unreadCount} unread notification(s)`}>
                    <Bell size={15} />
                    {unreadCount > 0 && <span className="pika-notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                  </Link>
                </>
              )}
            </div>
          </header>
          <div className="pika-dash-content">{children}</div>
        </section>
      </div>
    </main>
  );
}
