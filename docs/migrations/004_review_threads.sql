CREATE TABLE IF NOT EXISTS review_threads (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  anchor_revision INTEGER NOT NULL CHECK (anchor_revision >= 0),
  page_id TEXT NOT NULL,
  node_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id, document_id) REFERENCES documents(project_id, id) ON DELETE CASCADE,
  FOREIGN KEY (document_id, anchor_revision) REFERENCES document_revisions(document_id, revision) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS review_comments (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL REFERENCES review_threads(id) ON DELETE CASCADE,
  author TEXT NOT NULL DEFAULT 'You' CHECK (length(author) BETWEEN 1 AND 80),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS review_threads_project_updated ON review_threads(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS review_comments_thread_created ON review_comments(thread_id, created_at);
