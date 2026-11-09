ALTER TABLE assets ADD COLUMN kind TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image', 'reference'));
ALTER TABLE assets ADD COLUMN provenance_json TEXT NOT NULL DEFAULT '{"source":"legacy-local-upload"}' CHECK (json_valid(provenance_json));
