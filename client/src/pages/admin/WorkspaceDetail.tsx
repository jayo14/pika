import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plug, Radar, Users } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

export default function AdminWorkspaceDetailPage({ workspaceId }: { workspaceId: string }) {
  const workspaceQuery = useQuery({ queryKey: ["admin-workspace", workspaceId], queryFn: () => api.admin.workspaceDetail(workspaceId) });
  const workspace = workspaceQuery.data;

  return (
    <AdminShell active="workspaces" title="Workspace detail">
      <Link className="pika-admin-back" href="/admin/workspaces"><ArrowLeft size={14} />Back to workspaces</Link>

      {workspace && (
        <>
          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>{workspace.name}</span><p>Created {new Date(workspace.created_at).toLocaleString()}</p></div></div>
            <div className="pika-account-details">
              <div><small>Plan</small><b>{workspace.plan}</b></div>
              <div><small>Retention</small><b>{workspace.retention_days} days</b></div>
              <div><small>Members</small><b>{workspace.member_count}</b></div>
              <div><small>Workspace ID</small><b className="pika-mono">{workspace.id}</b></div>
            </div>
          </section>

          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>Members</span><p>Everyone with access to this workspace.</p></div></div>
            {!workspace.members.length ? (
              <div className="pika-table-empty"><Users size={20} /><b>No members.</b></div>
            ) : (
              <div className="pika-table-rows">
                {workspace.members.map((m) => (
                  <Link key={m.user_id} href={`/admin/users/${m.user_id}`} className="pika-admin-row-link">
                    <article>
                      <div className="table-conversation"><span className="pika-result-mark orange">{m.email.charAt(0).toUpperCase()}</span><span><b>{m.email}</b></span></div>
                      <span className="table-topic">{m.role}</span>
                      <span /><span />
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>Connected Discord servers</span></div></div>
            {!workspace.connections.length ? (
              <div className="pika-table-empty"><Plug size={20} /><b>No connections.</b></div>
            ) : (
              <div className="pika-table-rows">
                {workspace.connections.map((c) => (
                  <article key={c.id}>
                    <div className="table-conversation"><span className="pika-result-mark violet"><Plug size={14} /></span><span><b>{c.discord_guild_name ?? c.discord_guild_id}</b><small>Guild {c.discord_guild_id}</small></span></div>
                    <span className={`table-relevance relevance-${c.status === "active" ? "high" : "worth-a-look"}`}>{c.status}</span>
                    <span /><span />
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>Monitors</span></div></div>
            {!workspace.monitors.length ? (
              <div className="pika-table-empty"><Radar size={20} /><b>No monitors.</b></div>
            ) : (
              <div className="pika-table-rows">
                {workspace.monitors.map((m) => (
                  <article key={m.id}>
                    <div className="table-conversation"><span className="pika-result-mark coral"><Radar size={14} /></span><span><b>{m.name}</b><small>{m.monitor_type}</small></span></div>
                    <span className="table-topic">{m.enabled ? "Enabled" : "Paused"}</span>
                    <span /><span />
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
