import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDefaultDesignSystem, DesignDocumentSchema, migrateDocument, type DesignDocument, type DesignNode } from "@uds/design-core";
import { buildCodeExportFiles, collectImageSources, inspectExportSupport } from "@uds/renderer";
import { registerAIService } from "./ai-service.js";
import { DocumentCommandError, saveDocumentRevision } from "./document-commands.js";
import { registerLocalMutationOriginGuard } from "./request-origin.js";
import { convertPenpotV3Archive } from "./penpot-import.js";
import { createZip } from "./zip.js";

const dataRoot = resolve(process.env.UDS_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.env.HOME ?? process.cwd(), "UnifiedDesignStudio"));
const projectsRoot = join(dataRoot, "projects");
mkdirSync(projectsRoot, { recursive: true });
const db = new DatabaseSync(join(dataRoot, "studio.sqlite"));
db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
const migration = readFileSync(fileURLToPath(new URL("../../../docs/DATABASE_SCHEMA.sql", import.meta.url)), "utf8");
db.exec("CREATE TABLE IF NOT EXISTS app_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)");
const schemaVersion = db.prepare("SELECT 1 FROM app_migrations WHERE version = 1").get();
if (!schemaVersion) {
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(migration); db.prepare("INSERT INTO app_migrations (version, applied_at) VALUES (1, ?)").run(new Date().toISOString()); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const settingsMigration = readFileSync(fileURLToPath(new URL("../../../docs/migrations/002_workspace_settings.sql", import.meta.url)), "utf8");
if (!db.prepare("SELECT 1 FROM app_migrations WHERE version = 2").get()) {
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(settingsMigration); db.prepare("INSERT INTO app_migrations (version, applied_at) VALUES (2, ?)").run(new Date().toISOString()); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const assetProvenanceMigration = readFileSync(fileURLToPath(new URL("../../../docs/migrations/003_asset_provenance.sql", import.meta.url)), "utf8");
if (!db.prepare("SELECT 1 FROM app_migrations WHERE version = 3").get()) {
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(assetProvenanceMigration); db.prepare("INSERT INTO app_migrations (version, applied_at) VALUES (3, ?)").run(new Date().toISOString()); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const reviewThreadsMigration = readFileSync(fileURLToPath(new URL("../../../docs/migrations/004_review_threads.sql", import.meta.url)), "utf8");
if (!db.prepare("SELECT 1 FROM app_migrations WHERE version = 4").get()) {
  db.exec("BEGIN IMMEDIATE");
  try { db.exec(reviewThreadsMigration); db.prepare("INSERT INTO app_migrations (version, applied_at) VALUES (4, ?)").run(new Date().toISOString()); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register((await import("@fastify/multipart")).default, { limits: { files: 1, fileSize: 20 * 1024 * 1024 } });
registerLocalMutationOriginGuard(app);

app.get("/api/health", async () => ({ status: "ok" }));
app.get("/api/projects", async () => db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC").all());
app.post<{ Body: { name?: string } }>("/api/projects", async (request, reply) => {
  const name = request.body?.name?.trim();
  if (!name || name.length > 80) return reply.code(400).send({ error: "Project name must be between 1 and 80 characters." });
  const id = randomUUID();
  const now = new Date().toISOString();
  const path = join(projectsRoot, id);
  mkdirSync(join(path, "assets"), { recursive: true });
  const documentId = randomUUID();
  const pageId = randomUUID();
  const sampleDocument = { schemaVersion: 2, documentId, revision: 0, metadata: { name, createdAt: now, updatedAt: now }, designSystem: createDefaultDesignSystem(), pages: [{ id: pageId, name: "Page 1", children: [] }] };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO projects (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, name, path, now, now);
    db.prepare("INSERT INTO documents (id, project_id, name, schema_version, current_revision, created_at, updated_at) VALUES (?, ?, ?, 2, 0, ?, ?)").run(documentId, id, name, now, now);
    db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, 0, 2, ?, ?, 'Initial empty document')").run(documentId, JSON.stringify(sampleDocument), now);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not persist project metadata." }); }
  return reply.code(201).send({ id, name, updatedAt: now });
});
app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
  const project = db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE id = ? AND archived_at IS NULL").get(request.params.id) as { id: string; name: string; updatedAt: string } | undefined;
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const revision = db.prepare("SELECT snapshot_json AS snapshot FROM document_revisions WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?) ORDER BY created_at DESC LIMIT 1").get(request.params.id) as { snapshot: string } | undefined;
  return { ...project, document: revision ? migrateDocument(JSON.parse(revision.snapshot)) : null };
});
app.put<{ Params: { id: string }; Body: unknown }>("/api/projects/:id/document", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const parsed = DesignDocumentSchema.safeParse(request.body);
  if (!parsed.success) return reply.code(400).send({ error: "Document did not match the design schema.", issues: parsed.error.issues.map(issue => ({ path: issue.path.join("."), message: issue.message })) });
  try {
    return saveDocumentRevision(db, request.params.id, parsed.data, parsed.data.revision, "Saved from canvas editor");
  } catch (error) {
    if (error instanceof DocumentCommandError) {
      if (error.code === "revision_conflict") return reply.code(409).send({ error: error.message, currentRevision: error.currentRevision });
      if (error.code === "not_found") return reply.code(404).send({ error: error.message });
      if (error.code === "invalid_document") return reply.code(400).send({ error: error.message });
    }
    return reply.code(500).send({ error: "Could not save document revision." });
  }
});
app.get<{ Params: { id: string } }>("/api/projects/:id/revisions", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT r.document_id AS documentId, r.revision, r.created_at AS createdAt, r.summary FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE d.project_id = ? ORDER BY r.created_at DESC LIMIT 100").all(request.params.id);
});
app.get<{ Params: { id: string }; Querystring: { documentId?: string; fromRevision?: string; toRevision?: string } }>("/api/projects/:id/revisions/compare", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const fromRevision = Number(request.query.fromRevision);
  const toRevision = Number(request.query.toRevision);
  const documentId = request.query.documentId;
  if (!documentId || !Number.isSafeInteger(fromRevision) || fromRevision < 0 || !Number.isSafeInteger(toRevision) || toRevision < 0) {
    return reply.code(400).send({ error: "A document ID and two valid revision numbers are required." });
  }
  const from = loadProjectRevision(request.params.id, fromRevision, documentId);
  const to = loadProjectRevision(request.params.id, toRevision, documentId);
  if (!from || !to) return reply.code(404).send({ error: "One or both saved revisions were not found." });
  const beforePages = new Map(from.document.pages.map(page => [page.id, page] as const));
  const afterPages = new Map(to.document.pages.map(page => [page.id, page] as const));
  const pageChanges = [
    ...[...afterPages.values()].filter(page => !beforePages.has(page.id)).map(page => ({ kind: "added" as const, pageId: page.id, toName: page.name })),
    ...[...beforePages.values()].filter(page => !afterPages.has(page.id)).map(page => ({ kind: "removed" as const, pageId: page.id, fromName: page.name })),
    ...[...afterPages.values()].flatMap(page => {
      const previous = beforePages.get(page.id);
      return previous && previous.name !== page.name ? [{ kind: "renamed" as const, pageId: page.id, fromName: previous.name, toName: page.name }] : [];
    }),
  ];
  const beforeNodes = new Map(from.document.pages.flatMap(page => flattenReviewNodes(page.children, page.id, page.name)).map(item => [`${item.pageId}\u0000${item.node.id}`, item] as const));
  const afterNodes = new Map(to.document.pages.flatMap(page => flattenReviewNodes(page.children, page.id, page.name)).map(item => [`${item.pageId}\u0000${item.node.id}`, item] as const));
  const nodeChanges: { kind: "added" | "removed" | "modified"; pageId: string; nodeId: string; fromName?: string; toName?: string; fromPage?: string; toPage?: string }[] = [];
  const nodeKeys = new Set([...beforeNodes.keys(), ...afterNodes.keys()]);
  for (const nodeKey of nodeKeys) {
    const previous = beforeNodes.get(nodeKey);
    const next = afterNodes.get(nodeKey);
    if (!previous && next) nodeChanges.push({ kind: "added", pageId: next.pageId, nodeId: next.node.id, toName: next.node.name || next.node.type, toPage: next.pageName });
    else if (previous && !next) nodeChanges.push({ kind: "removed", pageId: previous.pageId, nodeId: previous.node.id, fromName: previous.node.name || previous.node.type, fromPage: previous.pageName });
    else if (previous && next) {
      const beforeFields = { ...(previous.node as unknown as Record<string, unknown>) };
      const afterFields = { ...(next.node as unknown as Record<string, unknown>) };
      delete beforeFields.children;
      delete afterFields.children;
      if (previous.pageId !== next.pageId || previous.parentId !== next.parentId || previous.index !== next.index || JSON.stringify(beforeFields) !== JSON.stringify(afterFields)) {
        nodeChanges.push({ kind: "modified", pageId: next.pageId, nodeId: next.node.id, fromName: previous.node.name || previous.node.type, toName: next.node.name || next.node.type, fromPage: previous.pageName, toPage: next.pageName });
      }
    }
  }
  const addedNodes = nodeChanges.filter(item => item.kind === "added").length;
  const removedNodes = nodeChanges.filter(item => item.kind === "removed").length;
  const modifiedNodes = nodeChanges.filter(item => item.kind === "modified").length;
  return {
    documentId, fromRevision, toRevision,
    pages: pageChanges,
    nodes: nodeChanges.slice(0, 100),
    truncated: nodeChanges.length > 100,
    designSystemChanged: JSON.stringify(from.document.designSystem) !== JSON.stringify(to.document.designSystem),
    prototypeChanged: JSON.stringify(from.document.prototype) !== JSON.stringify(to.document.prototype),
    summary: { addedPages: pageChanges.filter(item => item.kind === "added").length, removedPages: pageChanges.filter(item => item.kind === "removed").length, renamedPages: pageChanges.filter(item => item.kind === "renamed").length, addedNodes, removedNodes, modifiedNodes },
  };
});
app.post<{ Params: { id: string; revision: string }; Querystring: { documentId?: string } }>("/api/projects/:id/revisions/:revision/restore", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const sourceRevision = Number(request.params.revision);
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 0) return reply.code(400).send({ error: "Invalid revision number." });
  const row = db.prepare("SELECT r.document_id AS documentId, r.snapshot_json AS snapshot FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE d.project_id = ? AND r.revision = ? AND (? IS NULL OR r.document_id = ?) ORDER BY r.created_at DESC LIMIT 1").get(request.params.id, sourceRevision, request.query.documentId ?? null, request.query.documentId ?? null) as { documentId: string; snapshot: string } | undefined;
  if (!row) return reply.code(404).send({ error: "Revision not found." });
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT current_revision FROM documents WHERE id = ? AND project_id = ?").get(row.documentId, request.params.id) as { current_revision: number };
    const now = new Date().toISOString();
    const source = migrateDocument(JSON.parse(row.snapshot));
    const restored = { ...source, revision: current.current_revision + 1, metadata: { ...source.metadata, updatedAt: now } };
    db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, ?, ?, ?, ?, ?)").run(row.documentId, restored.revision, restored.schemaVersion, JSON.stringify(restored), now, `Restored from revision ${sourceRevision}`);
    db.prepare("UPDATE documents SET schema_version = ?, current_revision = ?, updated_at = ? WHERE id = ?").run(restored.schemaVersion, restored.revision, now, row.documentId);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, request.params.id);
    db.exec("COMMIT"); return restored;
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not restore revision." }); }
});
app.patch<{ Params: { id: string }; Body: { name?: string } }>("/api/projects/:id", async (request, reply) => {
  const name = request.body?.name?.trim();
  if (!name || name.length > 80) return reply.code(400).send({ error: "Project name must be between 1 and 80 characters." });
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE projects SET name = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").run(name, now, request.params.id);
  if (!result.changes) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE id = ?").get(request.params.id);
});
app.post<{ Params: { id: string } }>("/api/projects/:id/archive", async (request, reply) => {
  const now = new Date().toISOString();
  const result = db.prepare("UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL").run(now, now, request.params.id);
  if (!result.changes) return reply.code(404).send({ error: "Project not found." });
  return reply.code(204).send();
});

app.get<{ Params: { id: string } }>("/api/projects/:id/review/threads", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const rows = db.prepare("SELECT id, document_id AS documentId, anchor_revision AS anchorRevision, page_id AS pageId, node_id AS nodeId, status, created_at AS createdAt, updated_at AS updatedAt FROM review_threads WHERE project_id = ? ORDER BY updated_at DESC LIMIT 200").all(request.params.id) as { id: string; documentId: string; anchorRevision: number; pageId: string; nodeId: string | null; status: "open" | "resolved"; createdAt: string; updatedAt: string }[];
  return {
    threads: rows.map(thread => {
      const anchor = db.prepare("SELECT snapshot_json AS snapshot FROM document_revisions WHERE document_id = ? AND revision = ?").get(thread.documentId, thread.anchorRevision) as { snapshot: string } | undefined;
      let pageName = "Unknown page";
      let nodeName: string | null = null;
      if (anchor) {
        try {
          const parsed = DesignDocumentSchema.safeParse(migrateDocument(JSON.parse(anchor.snapshot)));
          if (parsed.success) {
            const page = parsed.data.pages.find(item => item.id === thread.pageId);
            if (page) {
              pageName = page.name;
              const node = thread.nodeId ? findReviewNode(page.children, thread.nodeId) : undefined;
              nodeName = node ? (node.name || node.type) : null;
            }
          }
        } catch { /* Keep the review marker readable if a legacy snapshot cannot be decoded. */ }
      }
      const comments = db.prepare("SELECT id, author, body, created_at AS createdAt FROM review_comments WHERE thread_id = ? ORDER BY created_at, id").all(thread.id) as { id: string; author: string; body: string; createdAt: string }[];
      return { ...thread, pageName, nodeName, comments };
    }),
  };
});

app.post<{ Params: { id: string }; Body: unknown }>("/api/projects/:id/review/threads", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const revision = typeof body.anchorRevision === "number" && Number.isSafeInteger(body.anchorRevision) ? body.anchorRevision : -1;
  const pageId = typeof body.pageId === "string" ? body.pageId : "";
  const nodeId = typeof body.nodeId === "string" && body.nodeId ? body.nodeId : null;
  const comment = typeof body.body === "string" ? body.body.trim() : "";
  if (!documentId || revision < 0 || !pageId || pageId.length > 128 || (nodeId && nodeId.length > 128) || !comment || comment.length > 5000) {
    return reply.code(400).send({ error: "A saved revision, page, and comment of 1–5000 characters are required." });
  }
  const anchor = loadProjectRevision(request.params.id, revision, documentId);
  if (!anchor) return reply.code(404).send({ error: "The selected project revision was not found." });
  const page = anchor.document.pages.find(item => item.id === pageId);
  if (!page || (nodeId && !findReviewNode(page.children, nodeId))) return reply.code(400).send({ error: "The review anchor is not present on that saved page." });
  const id = randomUUID();
  const commentId = randomUUID();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO review_threads (id, project_id, document_id, anchor_revision, page_id, node_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)").run(id, request.params.id, documentId, revision, pageId, nodeId, now, now);
    db.prepare("INSERT INTO review_comments (id, thread_id, author, body, created_at) VALUES (?, ?, 'You', ?, ?)").run(commentId, id, comment, now);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ? AND archived_at IS NULL").run(now, request.params.id);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not save the review comment." }); }
  return reply.code(201).send({ id, documentId, anchorRevision: revision, pageId, nodeId, status: "open", createdAt: now, updatedAt: now, comments: [{ id: commentId, author: "You", body: comment, createdAt: now }] });
});

app.post<{ Params: { id: string; threadId: string }; Body: unknown }>("/api/projects/:id/review/threads/:threadId/comments", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const comment = typeof body.body === "string" ? body.body.trim() : "";
  if (!comment || comment.length > 5000) return reply.code(400).send({ error: "Comment must be between 1 and 5000 characters." });
  const id = randomUUID();
  const now = new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const thread = db.prepare("SELECT status FROM review_threads WHERE id = ? AND project_id = ?").get(request.params.threadId, request.params.id) as { status: "open" | "resolved" } | undefined;
    if (!thread) { db.exec("ROLLBACK"); return reply.code(404).send({ error: "Review thread not found." }); }
    if (thread.status !== "open") { db.exec("ROLLBACK"); return reply.code(409).send({ error: "Reopen this review thread before replying." }); }
    db.prepare("INSERT INTO review_comments (id, thread_id, author, body, created_at) VALUES (?, ?, 'You', ?, ?)").run(id, request.params.threadId, comment, now);
    db.prepare("UPDATE review_threads SET updated_at = ? WHERE id = ? AND project_id = ? AND status = 'open'").run(now, request.params.threadId, request.params.id);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ? AND archived_at IS NULL").run(now, request.params.id);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not save the reply." }); }
  return reply.code(201).send({ id, author: "You", body: comment, createdAt: now });
});

app.patch<{ Params: { id: string; threadId: string }; Body: unknown }>("/api/projects/:id/review/threads/:threadId", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const status = body.status;
  if (status !== "open" && status !== "resolved") return reply.code(400).send({ error: "Thread status must be open or resolved." });
  const updatedAt = new Date().toISOString();
  const result = db.prepare("UPDATE review_threads SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?").run(status, updatedAt, request.params.threadId, request.params.id);
  if (!result.changes) return reply.code(404).send({ error: "Review thread not found." });
  db.prepare("UPDATE projects SET updated_at = ? WHERE id = ? AND archived_at IS NULL").run(updatedAt, request.params.id);
  return { id: request.params.threadId, status, updatedAt };
});

const defaultSettings = { theme: "system", recentProjectLimit: 12, selectedProvider: "none" } as const;
app.get("/api/settings", async () => {
  const row = db.prepare("SELECT value_json AS value FROM workspace_settings WHERE key = 'workspace'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) : defaultSettings;
});
app.put<{ Body: { theme?: string; recentProjectLimit?: number; selectedProvider?: string } }>("/api/settings", async (request, reply) => {
  const { theme, recentProjectLimit, selectedProvider } = request.body ?? {};
  if (Object.keys(request.body ?? {}).some(key => !["theme", "recentProjectLimit", "selectedProvider"].includes(key)) || !(["system", "light", "dark"].includes(theme ?? "")) || !Number.isInteger(recentProjectLimit) || (recentProjectLimit ?? 0) < 3 || (recentProjectLimit ?? 99) > 50 || !(["none", "openai", "anthropic", "google", "custom"].includes(selectedProvider ?? ""))) {
    return reply.code(400).send({ error: "Invalid workspace settings." });
  }
  const value = { theme, recentProjectLimit, selectedProvider };
  db.prepare("INSERT INTO workspace_settings (key, value_json, updated_at) VALUES ('workspace', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at").run(JSON.stringify(value), new Date().toISOString());
  return value;
});

const allowedImages = new Map([["image/png", ".png"], ["image/jpeg", ".jpg"], ["image/webp", ".webp"], ["image/gif", ".gif"]]);
const referenceAssets = new Map([["image/svg+xml", ".svg"], ["application/pdf", ".pdf"]]);
function matchesAssetSignature(mimeType: string, bytes: Buffer): boolean {
  if (mimeType === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (mimeType === "image/jpeg") return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/webp") return bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (mimeType === "image/gif") return ["GIF87a", "GIF89a"].includes(bytes.toString("ascii", 0, 6));
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/svg+xml") {
    const xml = bytes.toString("utf8").replace(/^\uFEFF/, "").trimStart();
    return xml.length > 0 && xml.length <= 5 * 1024 * 1024 && /^(?:<\?xml\b[^?]*\?>\s*)?<svg(?:\s|>)/i.test(xml);
  }
  return false;
}
const projectRootFor = (id: string) => db.prepare("SELECT root_path FROM projects WHERE id = ? AND archived_at IS NULL").get(id) as { root_path: string } | undefined;
function findReviewNode(nodes: DesignNode[], id: string): DesignNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    if ("children" in node) {
      const found = findReviewNode(node.children, id);
      if (found) return found;
    }
  }
}
function loadProjectRevision(projectId: string, revision: number, documentId?: string): { documentId: string; document: DesignDocument } | undefined {
  const row = db.prepare("SELECT r.document_id AS documentId, r.snapshot_json AS snapshot FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE d.project_id = ? AND r.revision = ? AND (? IS NULL OR r.document_id = ?) ORDER BY d.updated_at DESC LIMIT 1").get(projectId, revision, documentId ?? null, documentId ?? null) as { documentId: string; snapshot: string } | undefined;
  if (!row) return;
  try {
    const migrated = migrateDocument(JSON.parse(row.snapshot));
    const parsed = DesignDocumentSchema.safeParse(migrated);
    return parsed.success ? { documentId: row.documentId, document: parsed.data } : undefined;
  } catch { return; }
}
function flattenReviewNodes(nodes: DesignNode[], pageId: string, pageName: string, parentId: string | null = null): { node: DesignNode; pageId: string; pageName: string; parentId: string | null; index: number }[] {
  return nodes.flatMap((node, index) => [
    { node, pageId, pageName, parentId, index },
    ...( "children" in node ? flattenReviewNodes(node.children, pageId, pageName, node.id) : []),
  ]);
}
app.get<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT id, original_name AS name, mime_type AS mimeType, byte_size AS size, width, height, created_at AS createdAt, kind, provenance_json AS provenance FROM assets WHERE project_id = ? ORDER BY created_at DESC").all(request.params.id).map((row: any) => ({ ...row, provenance: JSON.parse(row.provenance) }));
});
app.get<{ Params: { id: string; assetId: string } }>("/api/projects/:id/assets/:assetId/content", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const asset = db.prepare("SELECT relative_path, mime_type, kind FROM assets WHERE id = ? AND project_id = ?").get(request.params.assetId, request.params.id) as { relative_path: string; mime_type: string; kind: string } | undefined;
  if (!asset) return reply.code(404).send({ error: "Asset not found." });
  const filePath = resolve(project.root_path, asset.relative_path);
  if (!filePath.startsWith(resolve(project.root_path) + sep) || !existsSync(filePath)) return reply.code(404).send({ error: "Asset file is unavailable." });
  const referenceOnly = asset.kind === "reference";
  return reply.header("content-type", referenceOnly ? "application/octet-stream" : asset.mime_type)
    .header("content-disposition", `${referenceOnly ? "attachment" : "inline"}; filename="${request.params.assetId}${referenceOnly ? extname(asset.relative_path) : allowedImages.get(asset.mime_type) ?? ".bin"}"`)
    .header("x-content-type-options", "nosniff").header("cache-control", "private, max-age=3600").send(readFileSync(filePath));
});
app.post<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: "Choose an image file to upload." });
  const originalName = part.filename?.slice(0, 255) || "uploaded-asset";
  const imageSuffix = allowedImages.get(part.mimetype);
  const penpotSource = /\.penpot$/i.test(originalName) && ["application/zip", "application/x-zip-compressed", "application/octet-stream", "application/vnd.penpot+zip"].includes(part.mimetype);
  const figmaSource = /\.fig$/i.test(originalName) && ["application/octet-stream", "application/zip", "application/x-zip-compressed", "application/vnd.figma"].includes(part.mimetype);
  const nativeReferenceSuffix = penpotSource ? ".penpot" : figmaSource ? ".fig" : undefined;
  const referenceSuffix = referenceAssets.get(part.mimetype) ?? nativeReferenceSuffix;
  const suffix = imageSuffix ?? referenceSuffix;
  if (!suffix) { await part.toBuffer(); return reply.code(415).send({ error: "Supported assets are PNG, JPEG, WebP, GIF, SVG, PDF, Figma .fig, and Penpot .penpot." }); }
  const bytes = await part.toBuffer();
  if (bytes.length > 20 * 1024 * 1024) return reply.code(413).send({ error: "Asset exceeds the 20 MB limit." });
  if (part.mimetype === "image/svg+xml" && bytes.length > 5 * 1024 * 1024) return reply.code(413).send({ error: "SVG reference files are limited to 5 MB." });
  const penpotZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && [[0x03, 0x04], [0x05, 0x06], [0x07, 0x08]].some(([a, b]) => bytes[2] === a && bytes[3] === b);
  if (penpotSource && !penpotZip) return reply.code(415).send({ error: "The Penpot reference must be a ZIP-based .penpot file." });
  if (!nativeReferenceSuffix && !matchesAssetSignature(part.mimetype, bytes)) return reply.code(415).send({ error: "File contents do not match the selected asset type." });
  let penpotImport: ReturnType<typeof convertPenpotV3Archive> | undefined;
  let importedDocument: DesignDocument | undefined;
  let conversionFailure: string | undefined;
  if (penpotSource) {
    const current = currentProjectDocument(request.params.id);
    if (!current) return reply.code(409).send({ error: "This project has no valid design document to receive imported pages." });
    try {
      penpotImport = convertPenpotV3Archive(bytes, current.designSystem);
      const parsed = DesignDocumentSchema.safeParse({ ...current, pages: [...current.pages, ...penpotImport.pages], designSystem: penpotImport.designSystem });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "The imported pages are not valid UDS content.");
      importedDocument = parsed.data;
    } catch (error) {
      penpotImport = undefined;
      conversionFailure = (error as Error).message.slice(0, 240);
    }
  }
  const id = randomUUID();
  const relativePath = `assets/${id}${suffix}`;
  const target = resolve(project.root_path, relativePath);
  if (!target.startsWith(resolve(project.root_path) + sep)) return reply.code(400).send({ error: "Invalid asset path." });
  writeFileSync(target, bytes, { flag: "wx" });
  const createdAt = new Date().toISOString();
  const digest = createHash("sha256").update(bytes).digest("hex");
  const kind = imageSuffix ? "image" : "reference";
  const conversionReport = nativeReferenceSuffix ? {
    format: nativeReferenceSuffix === ".fig" ? "figma-fig" : "penpot-archive",
    status: penpotImport ? "converted-with-limits" : "reference-only",
    sourcePreserved: true,
    pagesImported: penpotImport?.pages.length ?? 0,
    layersImported: penpotImport?.layersImported ?? 0,
    tokensImported: penpotImport?.tokensImported ?? 0,
    componentsImported: penpotImport?.componentsImported ?? 0,
    notes: penpotImport?.warnings ?? [conversionFailure ?? "Figma .fig conversion requires the Figma file API; the source is preserved as a downloadable reference."],
  } : undefined;
  const provenance = JSON.stringify({ source: "local-upload", originalName, importedAt: createdAt, sha256: digest, usage: kind === "image" ? "canvas-image" : penpotImport ? "converted-and-reference" : "reference-only", ...(conversionReport ? { conversionReport } : {}) });
  try { db.prepare("INSERT INTO assets (id, project_id, relative_path, sha256, mime_type, byte_size, created_at, original_name, kind, provenance_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, request.params.id, relativePath, digest, part.mimetype, bytes.length, createdAt, originalName, kind, provenance); }
  catch { unlinkSync(target); return reply.code(409).send({ error: "This image is already present in the project, or could not be indexed." }); }
  let savedDocument: DesignDocument | undefined;
  if (importedDocument) {
    try { savedDocument = saveDocumentRevision(db, request.params.id, importedDocument, importedDocument.revision, `Imported Penpot file: ${originalName}`); }
    catch (error) {
      db.prepare("DELETE FROM assets WHERE id = ? AND project_id = ?").run(id, request.params.id);
      unlinkSync(target);
      if (error instanceof DocumentCommandError && error.code === "revision_conflict") return reply.code(409).send({ error: "The project changed during import. Reopen the project and retry the Penpot import." });
      return reply.code(400).send({ error: (error as Error).message || "Penpot conversion could not be saved." });
    }
  }
  return reply.code(201).send({ id, name: originalName, mimeType: part.mimetype, size: bytes.length, createdAt, kind, provenance: JSON.parse(provenance), ...(savedDocument ? { document: savedDocument } : {}) });
});
app.delete<{ Params: { id: string; assetId: string } }>("/api/projects/:id/assets/:assetId", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const asset = db.prepare("SELECT relative_path FROM assets WHERE id = ? AND project_id = ?").get(request.params.assetId, request.params.id) as { relative_path: string } | undefined;
  if (!asset) return reply.code(404).send({ error: "Asset not found." });
  const filePath = resolve(project.root_path, asset.relative_path);
  if (!filePath.startsWith(resolve(project.root_path) + sep)) return reply.code(400).send({ error: "Invalid asset path." });
  if (existsSync(filePath)) unlinkSync(filePath);
  db.prepare("DELETE FROM assets WHERE id = ? AND project_id = ?").run(request.params.assetId, request.params.id);
  return reply.code(204).send();
});

function currentProjectDocument(projectId: string): DesignDocument | undefined {
  const row = db.prepare("SELECT r.snapshot_json AS snapshot FROM document_revisions r JOIN documents d ON d.id = r.document_id AND d.current_revision = r.revision WHERE d.project_id = ? ORDER BY d.updated_at DESC LIMIT 1").get(projectId) as { snapshot: string } | undefined;
  if (!row) return undefined;
  const parsed = DesignDocumentSchema.safeParse(JSON.parse(row.snapshot));
  return parsed.success ? parsed.data : undefined;
}

function projectAssetForExport(projectId: string, assetId: string): { relative_path: string; mime_type: string; byte_size: number } | undefined {
  return db.prepare("SELECT relative_path, mime_type, byte_size FROM assets WHERE project_id = ? AND id = ?").get(projectId, assetId) as { relative_path: string; mime_type: string; byte_size: number } | undefined;
}

function imageAssetId(source: string, projectId: string): string | undefined {
  const prefix = `/api/projects/${projectId}/assets/`;
  if (!source.startsWith(prefix) || !source.endsWith("/content")) return undefined;
  const assetId = source.slice(prefix.length, -"/content".length);
  return assetId && !assetId.includes("/") ? assetId : undefined;
}

app.get<{ Params: { id: string }; Querystring: { gitReady?: string } }>("/api/projects/:id/code-export/report", async (request, reply) => {
  if (request.query.gitReady !== undefined && !["true", "false"].includes(request.query.gitReady)) return reply.code(400).send({ error: "gitReady must be true or false." });
  const gitReady = request.query.gitReady === "true";
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const document = currentProjectDocument(request.params.id);
  if (!document) return reply.code(404).send({ error: "Project document is unavailable or invalid." });
  const sources = collectImageSources(document);
  const assets = sources.map(source => {
    const id = imageAssetId(source, request.params.id);
    const record = id ? projectAssetForExport(request.params.id, id) : undefined;
    const filePath = record ? resolve(project.root_path, record.relative_path) : "";
    const available = Boolean(record && filePath.startsWith(resolve(project.root_path) + sep) && existsSync(filePath));
    return { source, bundled: Boolean(record && allowedImages.has(record.mime_type) && available), byteSize: record?.byte_size ?? 0 };
  });
  const missing = assets.filter(asset => !asset.bundled).length;
  const findings = [...inspectExportSupport(document)];
  if (missing) findings.push({ severity: "warning", code: "missing-asset", message: `${missing} image source(s) are external or no longer available in this project and will be omitted.` });
  const files = ["index.html", "styles.css", "react/", "design-system/tokens.json", "export-report.json", "react/public/assets/"];
  if (gitReady) files.push(".gitignore", "GIT_HANDOFF.md");
  return { revision: document.revision, findings, assets: assets.length, bundledAssets: assets.filter(item => item.bundled).length, files };
});

app.get<{ Params: { id: string }; Querystring: { gitReady?: string } }>("/api/projects/:id/code-export", async (request, reply) => {
  if (request.query.gitReady !== undefined && !["true", "false"].includes(request.query.gitReady)) return reply.code(400).send({ error: "gitReady must be true or false." });
  const gitReady = request.query.gitReady === "true";
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const document = currentProjectDocument(request.params.id);
  if (!document) return reply.code(404).send({ error: "Project document is unavailable or invalid." });
  const htmlAssetPaths: Record<string, string> = {};
  const reactAssetPaths: Record<string, string> = {};
  const imageFiles: { path: string; data: Buffer }[] = [];
  let totalBytes = 0;
  for (const source of collectImageSources(document)) {
    const id = imageAssetId(source, request.params.id);
    if (!id) continue;
    const asset = projectAssetForExport(request.params.id, id);
    const extension = asset && allowedImages.get(asset.mime_type);
    if (!asset || !extension) continue;
    totalBytes += asset.byte_size;
    if (asset.byte_size > 20 * 1024 * 1024 || totalBytes > 100 * 1024 * 1024) return reply.code(413).send({ error: "Referenced project assets exceed the 100 MB code export limit." });
    const filePath = resolve(project.root_path, asset.relative_path);
    if (!filePath.startsWith(resolve(project.root_path) + sep) || !existsSync(filePath)) continue;
    const relative = `assets/${id}${extension}`;
    htmlAssetPaths[source] = `react/public/${relative}`;
    reactAssetPaths[source] = `/assets/${id}${extension}`;
    imageFiles.push({ path: `react/public/${relative}`, data: readFileSync(filePath) });
  }
  const files = buildCodeExportFiles(document, { htmlAssetPaths, reactAssetPaths, includeGitHandoff: gitReady });
  const archive = createZip([
    ...Object.entries(files).map(([path, content]) => ({ path, data: Buffer.from(content, "utf8") })),
    ...imageFiles,
  ]);
  return reply.header("content-type", "application/zip")
    .header("content-disposition", `attachment; filename="uds-code-handoff-${request.params.id.slice(0, 8)}${gitReady ? "-git-ready" : ""}.zip"`)
    .header("cache-control", "no-store")
    .send(archive);
});

registerAIService(app, db, projectRootFor);

const address = await app.listen({ host: "127.0.0.1", port: Number(process.env.UDS_PORT ?? 4318) });
app.log.info({ address, dataRoot }, "Unified Design Studio local service ready");
