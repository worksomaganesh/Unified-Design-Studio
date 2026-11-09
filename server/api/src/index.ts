import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

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
const app = Fastify({ logger: true, bodyLimit: 1024 * 1024 });
await app.register(helmet, { contentSecurityPolicy: false });
await app.register((await import("@fastify/multipart")).default, { limits: { files: 1, fileSize: 20 * 1024 * 1024 } });

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
  const sampleDocument = { schemaVersion: 1, documentId, revision: 0, metadata: { name, createdAt: now, updatedAt: now }, pages: [{ id: pageId, name: "Page 1", children: [] }] };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO projects (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(id, name, path, now, now);
    db.prepare("INSERT INTO documents (id, project_id, name, schema_version, current_revision, created_at, updated_at) VALUES (?, ?, ?, 1, 0, ?, ?)").run(documentId, id, name, now, now);
    db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, 0, 1, ?, ?, 'Initial empty document')").run(documentId, JSON.stringify(sampleDocument), now);
    db.exec("COMMIT");
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not persist project metadata." }); }
  return reply.code(201).send({ id, name, updatedAt: now });
});
app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
  const project = db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE id = ? AND archived_at IS NULL").get(request.params.id) as { id: string; name: string; updatedAt: string } | undefined;
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const revision = db.prepare("SELECT snapshot_json AS snapshot FROM document_revisions WHERE document_id IN (SELECT id FROM documents WHERE project_id = ?) ORDER BY created_at DESC LIMIT 1").get(request.params.id) as { snapshot: string } | undefined;
  return { ...project, document: revision ? JSON.parse(revision.snapshot) : null };
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
const projectRootFor = (id: string) => db.prepare("SELECT root_path FROM projects WHERE id = ? AND archived_at IS NULL").get(id) as { root_path: string } | undefined;
app.get<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT id, original_name AS name, mime_type AS mimeType, byte_size AS size, width, height, created_at AS createdAt FROM assets WHERE project_id = ? ORDER BY created_at DESC").all(request.params.id);
});
app.post<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: "Choose an image file to upload." });
  const suffix = allowedImages.get(part.mimetype);
  if (!suffix) { await part.toBuffer(); return reply.code(415).send({ error: "Only PNG, JPEG, WebP, and GIF images are supported." }); }
  const bytes = await part.toBuffer();
  if (bytes.length > 20 * 1024 * 1024) return reply.code(413).send({ error: "Image exceeds the 20 MB limit." });
  const id = randomUUID();
  const relativePath = `assets/${id}${suffix}`;
  const target = resolve(project.root_path, relativePath);
  if (!target.startsWith(resolve(project.root_path) + sep)) return reply.code(400).send({ error: "Invalid asset path." });
  writeFileSync(target, bytes, { flag: "wx" });
  const createdAt = new Date().toISOString();
  const digest = createHash("sha256").update(bytes).digest("hex");
  try { db.prepare("INSERT INTO assets (id, project_id, relative_path, sha256, mime_type, byte_size, created_at, original_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(id, request.params.id, relativePath, digest, part.mimetype, bytes.length, createdAt, part.filename?.slice(0, 255) || relativePath); }
  catch { unlinkSync(target); return reply.code(409).send({ error: "This image is already present in the project, or could not be indexed." }); }
  return reply.code(201).send({ id, name: part.filename || relativePath, mimeType: part.mimetype, size: bytes.length, createdAt });
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

const address = await app.listen({ host: "127.0.0.1", port: Number(process.env.UDS_PORT ?? 4318) });
app.log.info({ address, dataRoot }, "Unified Design Studio local service ready");
