import Fastify from "fastify";
import helmet from "@fastify/helmet";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { createDefaultDesignSystem, DesignDocumentSchema, migrateDocument, type DesignDocument } from "@uds/design-core";
import { buildCodeExportFiles, collectImageSources, inspectExportSupport } from "@uds/renderer";
import { registerAIService } from "./ai-service.js";
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
  const document = parsed.data;
  const owner = db.prepare("SELECT project_id FROM documents WHERE id = ?").get(document.documentId) as { project_id: string } | undefined;
  if (!owner || owner.project_id !== request.params.id) return reply.code(404).send({ error: "Document does not belong to this project." });
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT current_revision FROM documents WHERE id = ? AND project_id = ?").get(document.documentId, request.params.id) as { current_revision: number };
    if (document.revision !== current.current_revision) { db.exec("ROLLBACK"); return reply.code(409).send({ error: "Document revision conflict. Reload before saving." }); }
    const now = new Date().toISOString();
    const next = { ...document, revision: current.current_revision + 1, metadata: { ...document.metadata, updatedAt: now } };
    db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, ?, ?, ?, ?, ?)").run(document.documentId, next.revision, next.schemaVersion, JSON.stringify(next), now, "Saved from canvas editor");
    db.prepare("UPDATE documents SET schema_version = ?, current_revision = ?, updated_at = ? WHERE id = ? AND current_revision = ?").run(next.schemaVersion, next.revision, now, document.documentId, current.current_revision);
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, request.params.id);
    db.exec("COMMIT");
    return next;
  } catch { db.exec("ROLLBACK"); return reply.code(500).send({ error: "Could not save document revision." }); }
});
app.get<{ Params: { id: string } }>("/api/projects/:id/revisions", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT r.document_id AS documentId, r.revision, r.created_at AS createdAt, r.summary FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE d.project_id = ? ORDER BY r.created_at DESC LIMIT 100").all(request.params.id);
});
app.post<{ Params: { id: string; revision: string } }>("/api/projects/:id/revisions/:revision/restore", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  const sourceRevision = Number(request.params.revision);
  if (!Number.isSafeInteger(sourceRevision) || sourceRevision < 0) return reply.code(400).send({ error: "Invalid revision number." });
  const row = db.prepare("SELECT r.document_id AS documentId, r.snapshot_json AS snapshot FROM document_revisions r JOIN documents d ON d.id = r.document_id WHERE d.project_id = ? AND r.revision = ? ORDER BY r.created_at DESC LIMIT 1").get(request.params.id, sourceRevision) as { documentId: string; snapshot: string } | undefined;
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
app.get<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  if (!projectRootFor(request.params.id)) return reply.code(404).send({ error: "Project not found." });
  return db.prepare("SELECT id, original_name AS name, mime_type AS mimeType, byte_size AS size, width, height, created_at AS createdAt, kind, provenance_json AS provenance FROM assets WHERE project_id = ? ORDER BY created_at DESC").all(request.params.id).map((row: any) => ({ ...row, provenance: JSON.parse(row.provenance) }));
});
app.get<{ Params: { id: string; assetId: string } }>("/api/projects/:id/assets/:assetId/content", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const asset = db.prepare("SELECT relative_path, mime_type FROM assets WHERE id = ? AND project_id = ?").get(request.params.assetId, request.params.id) as { relative_path: string; mime_type: string } | undefined;
  if (!asset) return reply.code(404).send({ error: "Asset not found." });
  const filePath = resolve(project.root_path, asset.relative_path);
  if (!filePath.startsWith(resolve(project.root_path) + sep) || !existsSync(filePath)) return reply.code(404).send({ error: "Asset file is unavailable." });
  const referenceOnly = referenceAssets.has(asset.mime_type);
  return reply.header("content-type", referenceOnly ? "application/octet-stream" : asset.mime_type)
    .header("content-disposition", `${referenceOnly ? "attachment" : "inline"}; filename="${request.params.assetId}${referenceAssets.get(asset.mime_type) ?? allowedImages.get(asset.mime_type) ?? ".bin"}"`)
    .header("x-content-type-options", "nosniff").header("cache-control", "private, max-age=3600").send(readFileSync(filePath));
});
app.post<{ Params: { id: string } }>("/api/projects/:id/assets", async (request, reply) => {
  const project = projectRootFor(request.params.id);
  if (!project) return reply.code(404).send({ error: "Project not found." });
  const part = await request.file();
  if (!part) return reply.code(400).send({ error: "Choose an image file to upload." });
  const imageSuffix = allowedImages.get(part.mimetype);
  const referenceSuffix = referenceAssets.get(part.mimetype);
  const suffix = imageSuffix ?? referenceSuffix;
  if (!suffix) { await part.toBuffer(); return reply.code(415).send({ error: "Supported assets are PNG, JPEG, WebP, GIF, SVG, and PDF." }); }
  const bytes = await part.toBuffer();
  if (bytes.length > 20 * 1024 * 1024) return reply.code(413).send({ error: "Asset exceeds the 20 MB limit." });
  if (part.mimetype === "image/svg+xml" && bytes.length > 5 * 1024 * 1024) return reply.code(413).send({ error: "SVG reference files are limited to 5 MB." });
  if (!matchesAssetSignature(part.mimetype, bytes)) return reply.code(415).send({ error: "File contents do not match the selected asset type." });
  const id = randomUUID();
  const relativePath = `assets/${id}${suffix}`;
  const target = resolve(project.root_path, relativePath);
  if (!target.startsWith(resolve(project.root_path) + sep)) return reply.code(400).send({ error: "Invalid asset path." });
  writeFileSync(target, bytes, { flag: "wx" });
  const createdAt = new Date().toISOString();
  const digest = createHash("sha256").update(bytes).digest("hex");
  const originalName = part.filename?.slice(0, 255) || relativePath;
  const kind = imageSuffix ? "image" : "reference";
  const provenance = JSON.stringify({ source: "local-upload", originalName, importedAt: createdAt, sha256: digest, usage: kind === "image" ? "canvas-image" : "reference-only" });
  try { db.prepare("INSERT INTO assets (id, project_id, relative_path, sha256, mime_type, byte_size, created_at, original_name, kind, provenance_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(id, request.params.id, relativePath, digest, part.mimetype, bytes.length, createdAt, originalName, kind, provenance); }
  catch { unlinkSync(target); return reply.code(409).send({ error: "This image is already present in the project, or could not be indexed." }); }
  return reply.code(201).send({ id, name: originalName, mimeType: part.mimetype, size: bytes.length, createdAt, kind, provenance: JSON.parse(provenance) });
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
