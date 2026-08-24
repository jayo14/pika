import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Server } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

export default function AdminUserDetailPage({ userId }: { userId: string }) {
  const userQuery = useQuery({ queryKey: ["admin-user", userId], queryFn: () => api.admin.userDetail(userId) });
  const user = userQuery.data;

  return (
    <AdminShell active="users" title="User detail">
      <Link className="pika-admin-back" href="/admin/users"><ArrowLeft size={14} />Back to users</Link>

      {user && (
        <>
          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>{user.email}</span><p>Created {new Date(user.created_at).toLocaleString()}</p></div></div>
            <div className="pika-account-details">
              <div><small>Display name</small><b>{user.display_name ?? "—"}</b></div>
              <div><small>Status</small><b>{user.status}</b></div>
              <div><small>Role</small><b>{user.is_staff ? "Staff" : "Member"}</b></div>
              <div><small>User ID</small><b className="pika-mono">{user.id}</b></div>
            </div>
          </section>

          <section className="pika-conversations-table pika-page-block">
            <div className="pika-table-head"><div><span>Workspace memberships</span><p>Every workspace this user belongs to.</p></div></div>
            {!user.workspaces.length ? (
              <div className="pika-table-empty"><Server size={20} /><b>No workspace memberships.</b></div>
            ) : (
              <div className="pika-table-rows">
                {user.workspaces.map((m) => (
                  <Link key={m.workspace_id} href={`/admin/workspaces/${m.workspace_id}`} className="pika-admin-row-link">
                    <article>
                      <div className="table-conversation"><span className="pika-result-mark orange">{m.workspace_name.charAt(0).toUpperCase()}</span><span><b>{m.workspace_name}</b></span></div>
                      <span className="table-topic">{m.role}</span>
                      <span /><span />
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
