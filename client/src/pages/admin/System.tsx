import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { AdminShell } from "@/components/AdminShell";
import { api } from "@/lib/api";

function StatusRow({ label, ok, detail }: { label: string; ok: boolean; detail: string }) {
  return (
    <article className="pika-system-row">
      <div className="table-conversation">
        <span className={`pika-result-mark ${ok ? "violet" : "coral"}`}>{ok ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}</span>
        <span><b>{label}</b><small>{detail}</small></span>
      </div>
      <span className={`table-relevance relevance-${ok ? "high" : "worth-a-look"}`}>{ok ? "Healthy" : "Attention needed"}</span>
    </article>
  );
}

export default function AdminSystemPage() {
  const queryClient = useQueryClient();
  const healthQuery = useQuery({ queryKey: ["admin-health"], queryFn: api.admin.systemHealth, refetchInterval: 30_000 });
  const health = healthQuery.data;

  return (
    <AdminShell active="system" title="System health" subtitle="Live status of the services Pika depends on. Refreshes automatically every 30 seconds.">
      <section className="pika-conversations-table">
        <div className="pika-table-head">
          <div><span>Core services</span><p>Database, cache/queue, and background workers.</p></div>
          <button className="pika-icon-button" onClick={() => queryClient.invalidateQueries({ queryKey: ["admin-health"] })}><RefreshCw size={13} />Refresh</button>
        </div>
        <div className="pika-table-rows">
          <StatusRow label="PostgreSQL" ok={health?.database === "ok"} detail="Primary relational store." />
          <StatusRow label="Redis" ok={health?.redis === "ok"} detail="Sessions, OAuth state, rate limits, task queue." />
          <StatusRow
            label="Celery workers"
            ok={(health?.celery_workers_online ?? 0) > 0}
            detail={`${health?.celery_workers_online ?? 0} worker process(es) responded to a ping just now.`}
          />
        </div>
      </section>

      <section className="pika-dash-summary pika-page-block">
        <article><span className="summary-icon coral"><Activity size={17} /></span><div><small>Total users</small><b>{health?.total_users ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon violet"><Activity size={17} /></span><div><small>Total workspaces</small><b>{health?.total_workspaces ?? "…"}</b></div><em>All time</em></article>
        <article><span className="summary-icon orange"><Activity size={17} /></span><div><small>Active Discord connections</small><b>{health?.total_active_connections ?? "…"}</b></div><em>Right now</em></article>
      </section>

      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head"><div><span>Retention</span><p>Events the hourly purge task will delete in the next 24 hours.</p></div></div>
        <div className="pika-usage-row">
          <div><small>Events expiring soon</small><b>{health?.events_pending_expiry_next_24h ?? "…"}</b></div>
        </div>
      </section>
    </AdminShell>
  );
}
