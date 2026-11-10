-- SQLite initial schema. Apply numbered migrations transactionally; asset provenance is in 003 and local review threads/comments are in 004.
PRAGMA foreign_keys = ON;

CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  root_path TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT
);
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  current_revision INTEGER NOT NULL CHECK (current_revision >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, id)
);
CREATE TABLE document_revisions (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  schema_version INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  created_at TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  PRIMARY KEY(document_id, revision)
);
CREATE TABLE operations (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  revision INTEGER NOT NULL,
  sequence INTEGER NOT NULL CHECK (sequence >= 0),
  base_revision INTEGER NOT NULL,
  operation_json TEXT NOT NULL CHECK (json_valid(operation_json)),
  actor TEXT NOT NULL CHECK (actor IN ('user', 'ai', 'system')),
  created_at TEXT NOT NULL,
  FOREIGN KEY(document_id, revision) REFERENCES document_revisions(document_id, revision) ON DELETE CASCADE,
  UNIQUE(document_id, revision, sequence)
);
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  relative_path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK(byte_size >= 0),
  width INTEGER,
  height INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(project_id, relative_path),
  UNIQUE(project_id, sha256)
);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','running','review_required','completed','failed','cancelled')),
  input_summary TEXT NOT NULL DEFAULT '',
  result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);
CREATE INDEX documents_project_updated ON documents(project_id, updated_at DESC);
CREATE INDEX revisions_document_created ON document_revisions(document_id, created_at DESC);
CREATE INDEX operations_document_revision ON operations(document_id, revision, sequence);
CREATE INDEX assets_project_hash ON assets(project_id, sha256);
CREATE INDEX jobs_project_status ON jobs(project_id, status, created_at DESC);
