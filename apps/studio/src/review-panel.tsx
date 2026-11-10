import { useEffect, useState } from "react";
import "./review-panel.css";

type Tab = "comments" | "revisions";
type Revision = { documentId: string; revision: number; createdAt: string; summary: string };
type Comment = { id: string; author: string; body: string; createdAt: string };
type Thread = {
  id: string;
  documentId: string;
  anchorRevision: number;
  pageId: string;
  pageName: string;
  nodeId: string | null;
  nodeName: string | null;
  status: "open" | "resolved";
  createdAt: string;
  updatedAt: string;
  comments: Comment[];
};
type ReviewAnchor = { documentId: string; revision: number; pageId: string; nodeId?: string };
type CompareResult = {
  documentId: string;
  fromRevision: number;
  toRevision: number;
  pages: { kind: "added" | "removed" | "renamed"; pageId: string; fromName?: string; toName?: string }[];
  nodes: { kind: "added" | "removed" | "modified"; pageId: string; nodeId: string; fromName?: string; toName?: string; fromPage?: string; toPage?: string }[];
  truncated: boolean;
  designSystemChanged: boolean;
  prototypeChanged: boolean;
  summary: { addedPages: number; removedPages: number; renamedPages: number; addedNodes: number; removedNodes: number; modifiedNodes: number };
};

type Props = {
  projectId: string;
  documentId: string;
  currentRevision: number;
  anchor: { pageId: string; pageName: string; nodeId?: string; nodeName?: string };
  initialTab: Tab;
  ensureSaved: () => Promise<ReviewAnchor | null>;
  onRestore: (documentId: string, revision: number) => Promise<void>;
  onClose: () => void;
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error ?? `Request failed (${response.status})`);
  return body as T;
}

export function ReviewPanel({ projectId, documentId, currentRevision, anchor, initialTab, ensureSaved, onRestore, onClose }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [fromRevision, setFromRevision] = useState("");
  const [toRevision, setToRevision] = useState("");
  const [comparison, setComparison] = useState<CompareResult | null>(null);
  const [draft, setDraft] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refreshThreads() {
    const result = await request<{ threads: Thread[] }>(`/api/projects/${projectId}/review/threads`);
    setThreads(result.threads);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      request<{ threads: Thread[] }>(`/api/projects/${projectId}/review/threads`),
      request<Revision[]>(`/api/projects/${projectId}/revisions`),
    ]).then(([review, history]) => {
      if (!active) return;
      setThreads(review.threads);
      const scoped = history.filter(item => item.documentId === documentId);
      setRevisions(scoped);
      if (scoped.length) {
        setToRevision(String(scoped[0].revision));
        setFromRevision(String(scoped[Math.min(1, scoped.length - 1)].revision));
      }
      setError("");
    }).catch(cause => { if (active) setError((cause as Error).message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, documentId]);

  async function createThread(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const savedAnchor = await ensureSaved();
      if (!savedAnchor) throw new Error("Save the current design before starting a review comment.");
      await request(`/api/projects/${projectId}/review/threads`, {
        method: "POST",
        body: JSON.stringify({ documentId: savedAnchor.documentId, anchorRevision: savedAnchor.revision, pageId: savedAnchor.pageId, nodeId: savedAnchor.nodeId, body: draft }),
      });
      setDraft("");
      await refreshThreads();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function reply(threadId: string, event: React.FormEvent) {
    event.preventDefault();
    const body = replies[threadId] ?? "";
    setBusy(true); setError("");
    try {
      await request(`/api/projects/${projectId}/review/threads/${threadId}/comments`, { method: "POST", body: JSON.stringify({ body }) });
      setReplies(current => ({ ...current, [threadId]: "" }));
      await refreshThreads();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function setThreadStatus(thread: Thread, status: Thread["status"]) {
    setBusy(true); setError("");
    try {
      await request(`/api/projects/${projectId}/review/threads/${thread.id}`, { method: "PATCH", body: JSON.stringify({ status }) });
      await refreshThreads();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function compare() {
    if (!fromRevision || !toRevision) return;
    setBusy(true); setError(""); setComparison(null);
    try {
      const query = new URLSearchParams({ documentId, fromRevision, toRevision });
      setComparison(await request<CompareResult>(`/api/projects/${projectId}/revisions/compare?${query}`));
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function restore(revision: number) {
    setBusy(true); setError("");
    try { await onRestore(documentId, revision); }
    catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  const shownThreads = threads.filter(thread => filter === "all" || thread.status === filter);

  return <div className="review-scrim" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <aside className="review-panel" role="dialog" aria-modal="true" aria-labelledby="review-title">
      <header className="review-header">
        <div><span className="review-eyebrow">PHASE 9 · LOCAL REVIEW</span><h2 id="review-title">Review & history</h2><p>Comments stay attached to the saved page or layer revision.</p></div>
        <button className="review-close" onClick={onClose} aria-label="Close review panel">×</button>
      </header>
      <nav className="review-tabs" aria-label="Review views">
        <button className={tab === "comments" ? "active" : ""} aria-pressed={tab === "comments"} onClick={() => setTab("comments")}>Comments</button>
        <button className={tab === "revisions" ? "active" : ""} aria-pressed={tab === "revisions"} onClick={() => setTab("revisions")}>Revision compare</button>
      </nav>
      {error && <div className="review-error" role="alert">{error}</div>}
      {loading ? <p className="review-loading">Loading project review…</p> : tab === "comments" ? <div className="review-content">
        <form className="review-new-thread" onSubmit={createThread}>
          <label htmlFor="review-comment">New comment</label>
          <div className="review-anchor">{anchor.nodeName ? `Layer: ${anchor.nodeName} · ` : "Page: "}{anchor.pageName} · saved revision after save</div>
          <textarea data-discovery-id="uds-review-comment" id="review-comment" value={draft} onChange={event => setDraft(event.target.value)} maxLength={5000} placeholder="Leave feedback on this page or selected layer…" required />
          <div className="review-form-footer"><small>{draft.trim().length}/5000</small><button type="submit" disabled={busy || !draft.trim()}>{busy ? "Saving…" : "Add comment"}</button></div>
        </form>
        <div className="review-list-heading" data-discovery-id="uds-review-filter"><b>Threads</b><select aria-label="Filter review threads" value={filter} onChange={event => setFilter(event.target.value as typeof filter)}><option value="open">Open</option><option value="resolved">Resolved</option><option value="all">All</option></select></div>
        {shownThreads.length ? shownThreads.map(thread => <article className="review-thread" key={thread.id}>
          <div className="review-thread-anchor"><span>{thread.nodeName ? `Layer · ${thread.nodeName}` : `Page · ${thread.pageName}`}</span><small>r{thread.anchorRevision} · {new Date(thread.createdAt).toLocaleString()}</small></div>
          <div className="review-comments">{thread.comments.map(comment => <div className="review-comment" key={comment.id}><div><b>{comment.author}</b><time>{new Date(comment.createdAt).toLocaleString()}</time></div><p>{comment.body}</p></div>)}</div>
          <div className="review-thread-actions"><button onClick={() => void setThreadStatus(thread, thread.status === "open" ? "resolved" : "open")} disabled={busy}>{thread.status === "open" ? "Resolve" : "Reopen"}</button></div>
          {thread.status === "open" && <form className="review-reply" onSubmit={event => void reply(thread.id, event)}><textarea aria-label="Reply to comment" value={replies[thread.id] ?? ""} maxLength={5000} onChange={event => setReplies(current => ({ ...current, [thread.id]: event.target.value }))} placeholder="Reply…" required/><button disabled={busy || !(replies[thread.id] ?? "").trim()}>Reply</button></form>}
        </article>) : <div className="review-empty"><b>No {filter === "all" ? "" : `${filter} `}threads yet</b><span>Start a comment to make a page or layer reviewable.</span></div>}
        <p className="review-local-note">This workspace is local-only. Invites and multi-person access will be added after account and permission controls.</p>
      </div> : <div className="review-content">
        <div className="revision-compare-form" data-discovery-id="uds-review-compare"><label>From<select value={fromRevision} onChange={event => { setFromRevision(event.target.value); setComparison(null); }}>{revisions.map(item => <option key={`${item.documentId}-${item.revision}`} value={item.revision}>r{item.revision} · {item.summary || "Saved revision"}</option>)}</select></label><label>To<select value={toRevision} onChange={event => { setToRevision(event.target.value); setComparison(null); }}>{revisions.map(item => <option key={`${item.documentId}-${item.revision}`} value={item.revision}>r{item.revision} · {item.summary || "Saved revision"}</option>)}</select></label><button onClick={() => void compare()} disabled={busy || revisions.length < 2 || !fromRevision || !toRevision || fromRevision === toRevision}>Compare</button></div>
        {comparison ? <>
          <div className="revision-summary"><b>r{comparison.fromRevision} → r{comparison.toRevision}</b><span>{comparison.summary.addedPages} pages added · {comparison.summary.removedPages} removed · {comparison.summary.renamedPages} renamed</span><span>{comparison.summary.addedNodes} layers added · {comparison.summary.removedNodes} removed · {comparison.summary.modifiedNodes} modified</span>{comparison.designSystemChanged && <span>Design system changed</span>}{comparison.prototypeChanged && <span>Prototype interactions changed</span>}</div>
          {(comparison.pages.length > 0 || comparison.nodes.length > 0) ? <div className="revision-diff-list">
            {comparison.pages.map((item, index) => <div className="revision-diff-item" key={`page-${index}`}><span className={`diff-kind ${item.kind}`}>{item.kind}</span><b>{item.toName ?? item.fromName}</b><small>Page</small></div>)}
            {comparison.nodes.map(item => <div className="revision-diff-item" key={`node-${item.pageId}-${item.nodeId}-${item.kind}`}><span className={`diff-kind ${item.kind}`}>{item.kind}</span><b>{item.toName ?? item.fromName}</b><small>{item.toPage ?? item.fromPage}</small></div>)}
            {comparison.truncated && <p className="review-limit-note">Showing the first 100 changed layers.</p>}
          </div> : comparison.designSystemChanged || comparison.prototypeChanged ? <div className="review-empty"><b>Other saved state changed</b><span>The summary above flags design-system or prototype changes.</span></div> : <div className="review-empty"><b>No content changes</b><span>These saved revisions contain the same page and layer content.</span></div>}
          <button className="review-restore" data-discovery-id="uds-review-restore" onClick={() => void restore(comparison.fromRevision)} disabled={busy || comparison.fromRevision === currentRevision}>Restore r{comparison.fromRevision} as a new revision</button>
        </> : <div className="review-empty"><b>{revisions.length > 1 ? "Choose two revisions to compare" : "More history is needed"}</b><span>{revisions.length > 1 ? "The comparison shows page, layer, and design-system changes." : "Save another revision to compare changes."}</span></div>}
        <p className="review-local-note">Restore always creates a new saved revision; existing history is preserved.</p>
      </div>}
    </aside>
  </div>;
}
