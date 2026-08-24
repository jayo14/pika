import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, Server } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

const PAGE_SIZE = 20;

export default function AdminWorkspacesPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const workspacesQuery = useQuery({
    queryKey: ["admin-workspaces", PAGE_SIZE, page * PAGE_SIZE, q],
    queryFn: () => api.admin.workspaces({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, q: q || undefined }),
  });

  const items = workspacesQuery.data?.items ?? [];
  const total = workspacesQuery.data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  return (
    <AdminShell active="workspaces" title="Workspaces" subtitle="Every tenant, its plan, and its usage.">
      <section className="pika-conversations-table">
        <div className="pika-table-head">
          <div><span>{total} workspace{total === 1 ? "" : "s"}</span><p>Search by name.</p></div>
          <div className="pika-admin-search">
            <Search size={14} />
            <input placeholder="Search workspaces…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
        </div>
        {!items.length ? (
          <div className="pika-table-empty"><Server size={20} /><b>No workspaces found.</b></div>
        ) : (
          <div className="pika-table-rows">
            {items.map((ws) => (
              <Link key={ws.id} href={`/admin/workspaces/${ws.id}`} className="pika-admin-row-link">
                <article>
                  <div className="table-conversation"><span className="pika-result-mark violet">{ws.name.charAt(0).toUpperCase()}</span><span><b>{ws.name}</b><small>{ws.member_count} member(s) · {ws.connection_count} connection(s) · {ws.monitor_count} monitor(s)</small></span></div>
                  <span className="table-topic">{ws.plan}</span>
                  <span className="table-source">{ws.retention_days}d retention</span>
                  <span className="table-source">{new Date(ws.created_at).toLocaleDateString()}</span>
                </article>
              </Link>
            ))}
          </div>
        )}
        <div className="pika-pagination">
          <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}><ChevronLeft size={14} />Previous</button>
          <span>Page {page + 1}</span>
          <button disabled={!hasNext} onClick={() => setPage((p) => p + 1)}>Next<ChevronRight size={14} /></button>
        </div>
      </section>
    </AdminShell>
  );
}
