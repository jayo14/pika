// Pika intelligence home: real signals, saved items, and full-text search from the FastAPI backend.
import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Bookmark, Check, ChevronDown, Plus, Search, Sparkles } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api, type SearchResultItem, type Signal } from "@/lib/api";

type Tab = "search" | "signals" | "saved";

function relevanceFromRank(rank: number): "High" | "Useful" | "Worth a look" {
  if (rank > 0.1) return "High";
  if (rank > 0.03) return "Useful";
  return "Worth a look";
}

function relevanceFromScore(score: number): "High" | "Useful" | "Worth a look" {
  if (score >= 70) return "High";
  if (score >= 50) return "Useful";
  return "Worth a look";
}

const quickSearches = ["React developer", "Design agency", "Onboarding", "Product marketing"];

export default function Dashboard() {
  const { activeWorkspaceId } = useAuth();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspaceId ?? "";

  const [query, setQuery] = useState("Find people looking for a React developer");
  const [active, setActive] = useState<Tab>("search");

  const signalsQuery = useQuery({
    queryKey: ["signals", workspaceId],
    queryFn: () => api.signals.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const savedQuery = useQuery({
    queryKey: ["saved-items", workspaceId],
    queryFn: () => api.savedItems.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const monitorsQuery = useQuery({
    queryKey: ["monitors", workspaceId],
    queryFn: () => api.monitors.list(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const notificationsQuery = useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: () => api.notifications.list(workspaceId, true),
    enabled: Boolean(workspaceId),
  });

  const searchMutation = useMutation({
    mutationFn: (q: string) => api.search.run(workspaceId, q),
  });

  const saveSignalMutation = useMutation({
    mutationFn: (id: string) => api.signals.save(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signals", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["saved-items", workspaceId] });
    },
  });

  const saveSearchMutation = useMutation({ mutationFn: (id: string) => api.search.save(id) });

  const monitorNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const monitor of monitorsQuery.data ?? []) map.set(monitor.id, monitor.name);
    return map;
  }, [monitorsQuery.data]);

  const newSignals = (signalsQuery.data ?? []).filter((s) => s.status === "new");
  const savedItems = savedQuery.data ?? [];
  const unreadNotifications = notificationsQuery.data ?? [];
  const searchResults = searchMutation.data?.results ?? [];

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActive("search");
    if (workspaceId && query.trim()) searchMutation.mutate(query.trim());
  };
  const chooseQuickSearch = (text: string) => {
    const next = `Find ${text.toLowerCase()} conversations`;
    setQuery(next);
    setActive("search");
    if (workspaceId) searchMutation.mutate(next);
  };

  const signalTitle = (signal: Signal) => monitorNameById.get(signal.monitor_id) ?? signal.kind;
  const signalExcerpt = (signal: Signal) => signal.explanation.reasons.map((r) => r.description).join("; ") || "Matched a monitor rule.";

  const statusLabel = active === "search" ? "Search results" : active === "signals" ? "New signals" : "Saved items";

  return (
    <AppShell active="dashboard" title="Dashboard">
      <section className="pika-dash-search-area">
        <div>
          <span className="pika-dash-kicker"><Sparkles size={14} />Pika workspace</span>
          <h2>{active === "search" ? "Find the useful part of the conversation." : active === "signals" ? "See what your monitors caught." : "Revisit what you saved."}</h2>
        </div>
        <form onSubmit={submitSearch}>
          <Search size={18} />
          <input aria-label="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find people looking for a React developer" />
          <button type="submit" disabled={searchMutation.isPending}>{searchMutation.isPending ? "Searching…" : "Search"}</button>
        </form>
        <div className="pika-dash-quick">
          <span>Try a search:</span>
          {quickSearches.map((item) => <button type="button" key={item} onClick={() => chooseQuickSearch(item)}>{item}</button>)}
        </div>
      </section>

      <section className="pika-dash-summary">
        <article><span className="summary-icon coral"><Search size={17} /></span><div><small>Search results</small><b>{searchResults.length}</b></div><em>Last search</em></article>
        <article><span className="summary-icon violet"><Bell size={17} /></span><div><small>New signals</small><b>{newSignals.length}</b></div><em>Across monitors</em></article>
        <article><span className="summary-icon orange"><Bookmark size={17} /></span><div><small>Saved items</small><b>{savedItems.length}</b></div><em>Come back later</em></article>
      </section>

      <div className="pika-dash-grid">
        <section className="pika-pulse-panel">
          <div className="pika-panel-head">
            <div><span>Conversation pulse</span><p>Top-scored signals your monitors have surfaced.</p></div>
            <button type="button">This workspace <ChevronDown size={14} /></button>
          </div>
          <div className="pika-pulse-body">
            <div className="pika-pulse-left">
              <h3>{newSignals.length ? "New signals waiting for review" : "No new signals yet"}</h3>
              <p>Connect a server and create a monitor to start surfacing opportunities automatically.</p>
              <div className="pika-pulse-chart" aria-label="Illustrative conversation activity">
                <span className="chart-bar bar-one" /><span className="chart-bar bar-two" /><span className="chart-bar bar-three" /><span className="chart-bar bar-four" /><span className="chart-bar bar-five" /><span className="chart-line" />
              </div>
            </div>
            <div className="pika-thread-rank">
              <h4>Top signals</h4>
              {newSignals.slice(0, 3).map((signal, index) => (
                <button key={signal.id} onClick={() => saveSignalMutation.mutate(signal.id)}>
                  <span className={`rank-count rank-${index + 1}`}>{index + 1}</span>
                  <span className={`pika-result-mark ${["coral", "violet", "orange"][index % 3]}`}>{Math.round(signal.score)}</span>
                  <span><b>{signalTitle(signal)}</b><small>{signalExcerpt(signal)}</small></span>
                </button>
              ))}
              {!newSignals.length && <p className="pika-empty-inline">Nothing here yet.</p>}
            </div>
          </div>
        </section>
        <aside className="pika-dash-right">
          <section className="pika-activity-card">
            <span>Unread notifications</span>
            <p>Selective alerts from your monitors.</p>
            <div className="pika-activity-list">
              {unreadNotifications.slice(0, 4).map((n) => (
                <button key={n.id} onClick={() => api.notifications.markRead(n.id).then(() => queryClient.invalidateQueries({ queryKey: ["notifications", workspaceId] }))}>
                  <i />
                  <div><b>{n.priority} priority signal</b><small>{new Date(n.created_at).toLocaleString()}</small></div>
                  <span className="pika-result-mark violet">!</span>
                </button>
              ))}
              {!unreadNotifications.length && <p className="pika-empty-inline pika-empty-inline-dark">You're all caught up.</p>}
            </div>
          </section>
        </aside>
      </div>

      <section className="pika-conversations-table">
        <div className="pika-table-head">
          <div>
            <span>{statusLabel}</span>
            <p>{active === "search" ? `Showing results for “${searchMutation.variables ?? query}”` : active === "signals" ? "Matches from your active monitors." : "Signals you chose to keep."}</p>
          </div>
          <div className="pika-tab-switch">
            <button className={active === "search" ? "is-active" : ""} onClick={() => setActive("search")}>Search</button>
            <button className={active === "signals" ? "is-active" : ""} onClick={() => setActive("signals")}>Signals<i>{newSignals.length}</i></button>
            <button className={active === "saved" ? "is-active" : ""} onClick={() => setActive("saved")}>Saved<i>{savedItems.length}</i></button>
          </div>
          {active === "search" && searchMutation.data && (
            <button className="pika-save-search" onClick={() => saveSearchMutation.mutate(searchMutation.data.id)} disabled={saveSearchMutation.isPending || saveSearchMutation.isSuccess}>
              <Plus size={15} />{saveSearchMutation.isSuccess ? "Search saved" : "Save this search"}
            </button>
          )}
        </div>

        {active === "search" && (
          <SearchResultsTable results={searchResults} pending={searchMutation.isPending} hasSearched={Boolean(searchMutation.data)} />
        )}
        {active === "signals" && (
          <SignalsTable signals={newSignals} title={signalTitle} excerpt={signalExcerpt} onSave={(id) => saveSignalMutation.mutate(id)} />
        )}
        {active === "saved" && (
          <SavedTable items={savedItems} signalsById={new Map((signalsQuery.data ?? []).map((s) => [s.id, s]))} title={signalTitle} />
        )}
      </section>
    </AppShell>
  );
}

function SearchResultsTable({ results, pending, hasSearched }: { results: SearchResultItem[]; pending: boolean; hasSearched: boolean }) {
  if (pending) return <div className="pika-table-empty"><Search size={20} /><b>Searching…</b></div>;
  if (!hasSearched) return <div className="pika-table-empty"><Search size={20} /><b>Run a search to see results.</b><span>Full-text search over your authorized, monitored channels.</span></div>;
  if (!results.length) return <div className="pika-table-empty"><Search size={20} /><b>No matches yet.</b><span>Try a broader search or connect more channels.</span></div>;
  return (
    <div className="pika-table-rows">
      {results.map((item) => (
        <article key={item.event_id}>
          <div className="table-conversation"><span className="pika-result-mark coral">#</span><span><b>{item.snippet}</b><small>{item.event_type} · {new Date(item.occurred_at).toLocaleString()}</small></span></div>
          <span className="table-source">Event</span>
          <span className="table-topic">match</span>
          <span className={`table-relevance relevance-${relevanceFromRank(item.rank).toLowerCase().replaceAll(" ", "-")}`}>{relevanceFromRank(item.rank)}</span>
          <span />
        </article>
      ))}
    </div>
  );
}

function SignalsTable({ signals, title, excerpt, onSave }: { signals: Signal[]; title: (s: Signal) => string; excerpt: (s: Signal) => string; onSave: (id: string) => void }) {
  if (!signals.length) return <div className="pika-table-empty"><Bell size={20} /><b>No new signals.</b><span>Create a monitor to start catching opportunities.</span></div>;
  return (
    <div className="pika-table-rows">
      {signals.map((signal) => (
        <article key={signal.id}>
          <div className="table-conversation"><span className="pika-result-mark violet">{Math.round(signal.score)}</span><span><b>{title(signal)}</b><small>{excerpt(signal)}</small></span></div>
          <span className="table-source">{signal.kind}</span>
          <span className="table-topic">score {Math.round(signal.score)}</span>
          <span className={`table-relevance relevance-${relevanceFromScore(signal.score).toLowerCase().replaceAll(" ", "-")}`}>{relevanceFromScore(signal.score)}</span>
          <button onClick={() => onSave(signal.id)}><Bookmark size={15} /><span>Save</span></button>
        </article>
      ))}
    </div>
  );
}

function SavedTable({ items, signalsById, title }: { items: { id: string; signal_id: string; status: string; created_at: string }[]; signalsById: Map<string, Signal>; title: (s: Signal) => string }) {
  if (!items.length) return <div className="pika-table-empty"><Bookmark size={20} /><b>No saved items yet.</b><span>Save a signal when you want to come back to it.</span></div>;
  return (
    <div className="pika-table-rows">
      {items.map((item) => {
        const signal = signalsById.get(item.signal_id);
        return (
          <article key={item.id}>
            <div className="table-conversation"><span className="pika-result-mark orange">★</span><span><b>{signal ? title(signal) : "Saved signal"}</b><small>Saved {new Date(item.created_at).toLocaleDateString()}</small></span></div>
            <span className="table-source">{signal?.kind ?? "—"}</span>
            <span className="table-topic">{item.status}</span>
            <span className="table-relevance relevance-useful">Saved</span>
            <button className="is-saved"><Check size={15} /><span>Saved</span></button>
          </article>
        );
      })}
    </div>
  );
}
