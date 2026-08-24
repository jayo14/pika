import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api, type SavedItem, type Signal } from "@/lib/api";

const STATUSES = ["open", "researching", "watching", "contacted", "qualified", "won", "ignored", "archived"];

export default function SavedPage() {
  const { activeWorkspaceId } = useAuth();
  const workspaceId = activeWorkspaceId ?? "";
  const queryClient = useQueryClient();

  const savedQuery = useQuery({ queryKey: ["saved-items", workspaceId], queryFn: () => api.savedItems.list(workspaceId), enabled: Boolean(workspaceId) });
  const signalsQuery = useQuery({ queryKey: ["signals", workspaceId], queryFn: () => api.signals.list(workspaceId), enabled: Boolean(workspaceId) });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<{ status: string; note: string }> }) => api.savedItems.update(id, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["saved-items", workspaceId] }),
  });

  const items = savedQuery.data ?? [];
  const signalsById = new Map((signalsQuery.data ?? []).map((s) => [s.id, s]));

  return (
    <AppShell active="saved" title="Saved">
      <section className="pika-conversations-table pika-page-block">
        <div className="pika-table-head"><div><span>Your saved items</span><p>Signals you kept for later, with notes and status to track outreach.</p></div></div>
        {!items.length ? (
          <div className="pika-table-empty"><Bookmark size={20} /><b>Nothing saved yet.</b><span>Save a signal from the Dashboard to see it here.</span></div>
        ) : (
          <div className="pika-saved-list">
            {items.map((item) => <SavedRow key={item.id} item={item} signal={signalsById.get(item.signal_id)} onUpdate={(body) => updateMutation.mutate({ id: item.id, body })} />)}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function SavedRow({ item, signal, onUpdate }: { item: SavedItem; signal: Signal | undefined; onUpdate: (body: Partial<{ status: string; note: string }>) => void }) {
  const [note, setNote] = useState(item.note ?? "");
  return (
    <article className="pika-saved-row">
      <div className="table-conversation"><span className="pika-result-mark orange">★</span><span><b>{signal?.kind ?? "Saved signal"}</b><small>{signal?.explanation.reasons.map((r) => r.description).join("; ") || "No details available."}</small></span></div>
      <select value={item.status} onChange={(e) => onUpdate({ status: e.target.value })}>
        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <textarea placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => { if (note !== (item.note ?? "")) onUpdate({ note }); }} />
    </article>
  );
}
