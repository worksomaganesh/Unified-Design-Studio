import { DatabaseSync } from "node:sqlite";
import { DesignDocumentSchema, type DesignDocument, type DesignNode } from "@uds/design-core";

export type LayerCommand =
  | { type: "set_text"; pageId: string; nodeId: string; text: string }
  | { type: "rename_layer"; pageId: string; nodeId: string; name: string };

export class DocumentCommandError extends Error {
  constructor(
    readonly code: "not_found" | "revision_conflict" | "invalid_document" | "invalid_command",
    message: string,
    readonly currentRevision?: number,
  ) {
    super(message);
    this.name = "DocumentCommandError";
  }
}

function flatten(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap(node => [node, ...( "children" in node ? flatten(node.children) : [])]);
}

export function applyLayerCommand(document: DesignDocument, command: LayerCommand): DesignDocument {
  const page = document.pages.find(item => item.id === command.pageId);
  if (!page) throw new DocumentCommandError("not_found", "Page not found in this project.");
  const targets = flatten(page.children).filter(node => node.id === command.nodeId);
  if (targets.length !== 1) throw new DocumentCommandError("not_found", "Layer not found or ambiguous in this page.");
  const target = targets[0];
  if (command.type === "set_text" && target.type !== "text") {
    throw new DocumentCommandError("invalid_command", "Text can only be changed on a text layer.");
  }
  if (command.type === "set_text" && target.type === "text" && target.text === command.text) return document;
  if (command.type === "rename_layer" && target.name === command.name) return document;

  const updateNodes = (nodes: DesignNode[]): DesignNode[] => nodes.map(node => {
    let updated = node;
    if (node.id === command.nodeId) {
      if (command.type === "set_text") {
        if (node.type === "text") updated = { ...node, text: command.text };
      } else {
        updated = { ...node, name: command.name };
      }
    }
    if ("children" in updated) updated = { ...updated, children: updateNodes(updated.children) } as DesignNode;
    return updated;
  });

  const candidate = {
    ...document,
    pages: document.pages.map(item => item.id === command.pageId ? { ...item, children: updateNodes(item.children) } : item),
  };
  const parsed = DesignDocumentSchema.safeParse(candidate);
  if (!parsed.success) throw new DocumentCommandError("invalid_document", "The layer change did not pass the design document schema.");
  return parsed.data;
}

export function saveDocumentRevision(
  db: DatabaseSync,
  projectId: string,
  input: DesignDocument,
  expectedRevision: number,
  summary: string,
): DesignDocument {
  const parsed = DesignDocumentSchema.safeParse(input);
  if (!parsed.success || parsed.data.revision !== expectedRevision) {
    throw new DocumentCommandError("invalid_document", "The supplied document is invalid or does not match the expected revision.");
  }

  let transactionOpen = false;
  try {
    db.exec("BEGIN IMMEDIATE");
    transactionOpen = true;
    const current = db.prepare("SELECT d.current_revision AS revision FROM documents d JOIN projects p ON p.id = d.project_id WHERE d.id = ? AND d.project_id = ? AND p.archived_at IS NULL")
      .get(parsed.data.documentId, projectId) as { revision: number } | undefined;
    if (!current) throw new DocumentCommandError("not_found", "Project or document not found.");
    if (current.revision !== expectedRevision) {
      throw new DocumentCommandError("revision_conflict", "The project changed since this edit was read. Reload before applying the change.", current.revision);
    }

    const now = new Date().toISOString();
    const next = { ...parsed.data, revision: current.revision + 1, metadata: { ...parsed.data.metadata, updatedAt: now } };
    const safeSummary = summary.trim().slice(0, 200) || "Saved document command";
    db.prepare("INSERT INTO document_revisions (document_id, revision, schema_version, snapshot_json, created_at, summary) VALUES (?, ?, ?, ?, ?, ?)")
      .run(next.documentId, next.revision, next.schemaVersion, JSON.stringify(next), now, safeSummary);
    const updated = db.prepare("UPDATE documents SET schema_version = ?, current_revision = ?, updated_at = ? WHERE id = ? AND project_id = ? AND current_revision = ?")
      .run(next.schemaVersion, next.revision, now, next.documentId, projectId, current.revision);
    if (Number(updated.changes) !== 1) {
      const latest = db.prepare("SELECT current_revision AS revision FROM documents WHERE id = ? AND project_id = ?").get(next.documentId, projectId) as { revision: number } | undefined;
      throw new DocumentCommandError("revision_conflict", "The project changed while this edit was being saved. Reload before applying the change.", latest?.revision);
    }
    db.prepare("UPDATE projects SET updated_at = ? WHERE id = ?").run(now, projectId);
    db.exec("COMMIT");
    transactionOpen = false;
    return next;
  } catch (error) {
    if (transactionOpen) {
      try { db.exec("ROLLBACK"); } catch { /* Preserve the original command failure. */ }
    }
    throw error;
  }
}
