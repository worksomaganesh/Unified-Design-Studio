CREATE TABLE IF NOT EXISTS workspace_settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  updated_at TEXT NOT NULL
);
ALTER TABLE assets ADD COLUMN original_name TEXT NOT NULL DEFAULT '';
