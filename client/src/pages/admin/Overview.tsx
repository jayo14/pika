import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowUpRight, Radar, Server, Users } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

export default function AdminOverviewPage() {
  const healthQuery = useQuery({ queryKey: ["admin-health"], queryFn: api.admin.systemHealth, refetchInterval: 30_000 });
  const usersQuery = useQuery({ queryKey: ["admin-users", 1, 0, ""], queryFn: () => api.admin.users({ limit: 5 }) });
  const workspacesQuery = useQuery({ queryKey: ["admin-workspaces", 1, 0, ""], queryFn: () => api.admin.workspaces({ limit: 5 }) });

  const health = healthQuery.data;

  return (
    <AdminShell active="overview" title="Admin overview" subtitle="Cross-tenant health and the newest accounts and workspaces on this server.">
      <section className="pika-dash-summary">
        <article><span className="summary-icon coral"><Activity size={17} /></span><div><small>Database</small><b>{health?.database ?? "…"}</b></div><em>Live</em></article>
        <article><span className="summary-icon violet"><Activity size={17} /></span><div><small>Redis</small><b>{health?.redis ?? "…"}</b></div><em>Live</em></article>
        <article><span className="summary-icon orange"><Activity size={17} /></span><div><small>Celery workers</small><b>{health?.celery_workers_online ?? "…"}</b></div><em>Online</em></article>
      </section>

      <section className="pika-dash-summary pika-page-block">
        <article><span className="summary-icon coral"><Users size={17} /></span><div><small>Total users</small><b>{health?.total_users ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon violet"><Server size={17} /></span><div><small>Total workspaces</small><b>{health?.total_workspaces ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon orange"><Radar size={17} /></span><div><small>Active connections</small><b>{health?.total_active_connections ?? "…"}</b></div><em>Right now</em></article>
      </section>

      <div className="pika-admin-grid pika-page-block">
        <section className="pika-conversations-table">
          <div className="pika-table-head"><div><span>Newest users</span><p>Most recently created accounts.</p></div><Link className="pika-icon-button" href="/admin/users">View all<ArrowUpRight size={13} /></Link></div>
          <div className="pika-table-rows">
            {(usersQuery.data?.items ?? []).map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="pika-admin-row-link">
                <article>
                  <div className="table-conversation"><span className="pika-result-mark violet">{u.email.charAt(0).toUpperCase()}</span><span><b>{u.email}</b><small>{new Date(u.created_at).toLocaleDateString()}</small></span></div>
                  <span className="table-topic">{u.status}</span>
                  <span className="table-source">{u.is_staff ? "Staff" : "Member"}</span>
                  <span />
                </article>
              </Link>
            ))}
          </div>
        </section>
        <section className="pika-conversations-table">
          <div className="pika-table-head"><div><span>Newest workspaces</span><p>Most recently created tenants.</p></div><Link className="pika-icon-button" href="/admin/workspaces">View all<ArrowUpRight size={13} /></Link></div>
          <div className="pika-table-rows">
            {(workspacesQuery.data?.items ?? []).map((ws) => (
              <Link key={ws.id} href={`/admin/workspaces/${ws.id}`} className="pika-admin-row-link">
                <article>
                  <div className="table-conversation"><span className="pika-result-mark orange">{ws.name.charAt(0).toUpperCase()}</span><span><b>{ws.name}</b><small>{ws.member_count} member(s)</small></span></div>
                  <span className="table-topic">{ws.plan}</span>
                  <span className="table-source">{new Date(ws.created_at).toLocaleDateString()}</span>
                  <span />
                </article>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminShell>
  );
}
