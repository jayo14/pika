import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, Users as UsersIcon } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const usersQuery = useQuery({
    queryKey: ["admin-users", PAGE_SIZE, page * PAGE_SIZE, q],
    queryFn: () => api.admin.users({ limit: PAGE_SIZE, offset: page * PAGE_SIZE, q: q || undefined }),
  });

  const items = usersQuery.data?.items ?? [];
  const total = usersQuery.data?.total ?? 0;
  const hasNext = (page + 1) * PAGE_SIZE < total;

  return (
    <AdminShell active="users" title="Users" subtitle="Every Pika account on this server.">
      <section className="pika-conversations-table">
        <div className="pika-table-head">
          <div><span>{total} user{total === 1 ? "" : "s"}</span><p>Search by email.</p></div>
          <div className="pika-admin-search">
            <Search size={14} />
            <input placeholder="Search email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </div>
        </div>
        {!items.length ? (
          <div className="pika-table-empty"><UsersIcon size={20} /><b>No users found.</b></div>
        ) : (
          <div className="pika-table-rows">
            {items.map((u) => (
              <Link key={u.id} href={`/admin/users/${u.id}`} className="pika-admin-row-link">
                <article>
                  <div className="table-conversation"><span className="pika-result-mark violet">{u.email.charAt(0).toUpperCase()}</span><span><b>{u.email}</b><small>{u.display_name ?? "No display name"}</small></span></div>
                  <span className="table-topic">{u.status}</span>
                  <span className="table-source">{u.is_staff ? "Staff" : "Member"}</span>
                  <span className="table-source">{new Date(u.created_at).toLocaleDateString()}</span>
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
