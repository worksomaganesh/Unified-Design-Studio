import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { createDefaultDesignSystem, type DesignDocument } from "../../packages/design-core/src/index.ts";
import { DocumentCommandError, saveDocumentRevision } from "../../server/api/src/document-commands.ts";

const repoRoot = resolve(import.meta.dirname, "../..");
const timestamp = "2026-11-11T00:00:00.000Z";

function migratedDatabase(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(readFileSync(resolve(repoRoot, "docs/DATABASE_SCHEMA.sql"), "utf8"));
  for (const migration of ["002_workspace_settings.sql", "003_asset_provenance.sql", "004_review_threads.sql"]) {
    db.exec(readFileSync(resolve(repoRoot, "docs/migrations", migration), "utf8"));
  }
  // Migration 004 is intentionally safe to reapply, matching recovery after an interrupted startup.
  db.exec(readFileSync(resolve(repoRoot, "docs/migrations/004_review_threads.sql"), "utf8"));
  return db;
}

function seedProject(db: DatabaseSync): DesignDocument {
  const document: DesignDocument = {
    schemaVersion: 2,
    documentId: "document-1",
    revision: 0,
    metadata: { name: "Review recovery", createdAt: timestamp, updatedAt: timestamp },
    designSystem: createDefaultDesignSystem(),
    pages: [{ id: "page-1", name: "Page 1", children: [] }],
    prototype: { variables: [], connections: [] },
  };
  db.prepare("INSERT INTO projects (id, name, root_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .run("project-1", "Review recovery", "memory://project-1", timestamp, timestamp);
  db.prepare("INSERT INTO documents (id, project_id, name, schema_version, current_revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(document.documentId, "project-1", document.metadata.name, document.schemaVersion, 0, timestamp, timestamp);
  db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, ?, ?, ?, ?, ?)")
    .run(document.documentId, 0, document.schemaVersion, JSON.stringify(document), timestamp, "Initial state");
  return document;
}

test("Phase 9 review migration is repeatable, constrained, and cascades with its project", () => {
  const db = migratedDatabase();
  try {
    seedProject(db);
    db.prepare("INSERT INTO review_threads (id, project_id, document_id, anchor_revision, page_id, node_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run("thread-1", "project-1", "document-1", 0, "page-1", null, "open", timestamp, timestamp);
    db.prepare("INSERT INTO review_comments (id, thread_id, body, created_at) VALUES (?, ?, ?, ?)")
      .run("comment-1", "thread-1", "Review note", timestamp);

    assert.throws(() => db.prepare("UPDATE review_threads SET status = 'pending' WHERE id = 'thread-1'").run());
    assert.throws(() => db.prepare("INSERT INTO review_comments (id, thread_id, body, created_at) VALUES (?, ?, ?, ?)").run("comment-bad", "thread-1", "x".repeat(5001), timestamp));
    assert.throws(() => db.prepare("INSERT INTO review_threads (id, project_id, document_id, anchor_revision, page_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'open', ?, ?)").run("thread-orphan", "project-1", "document-1", 99, "page-1", timestamp, timestamp));

    db.prepare("DELETE FROM projects WHERE id = ?").run("project-1");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM review_threads").get()?.count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM review_comments").get()?.count, 0);
  } finally { db.close(); }
});

test("stale document saves report the latest revision without replacing it", () => {
  const db = migratedDatabase();
  try {
    const original = seedProject(db);
    const firstSave = saveDocumentRevision(db, "project-1", original, 0, "First local edit");
    assert.equal(firstSave.revision, 1);

    assert.throws(() => saveDocumentRevision(db, "project-1", original, 0, "Stale edit"), (error: unknown) => {
      assert.ok(error instanceof DocumentCommandError);
      assert.equal(error.code, "revision_conflict");
      assert.equal(error.currentRevision, 1);
      return true;
    });
    assert.equal(db.prepare("SELECT current_revision AS revision FROM documents WHERE id = 'document-1'").get()?.revision, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM document_revisions WHERE document_id = 'document-1'").get()?.count, 2);
  } finally { db.close(); }
});

test("editor conflict recovery keeps a safe path and makes draft replacement explicit", () => {
  const source = readFileSync(resolve(repoRoot, "apps/studio/src/canvas-editor.tsx"), "utf8");
  assert.ok(source.includes("response.status === 409"));
  assert.ok(source.includes("local changes preserved"));
  assert.ok(source.includes('role="alertdialog" aria-modal="true"'));
  assert.ok(source.includes("Download draft backup"));
  assert.ok(source.includes("Discard draft and load"));
  assert.ok(source.includes("DesignDocumentSchema.safeParse(body.document)"));
  assert.ok(source.includes("setUndoStack([])"));
  assert.ok(source.includes("There is no automatic merge"));
});
