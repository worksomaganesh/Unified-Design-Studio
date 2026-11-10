import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { DesignDocumentSchema, type DesignNode } from "@uds/design-core";
import { applyLayerCommand, DocumentCommandError, saveDocumentRevision } from "./document-commands.js";
import * as z from "zod-v4";

const dataRoot = resolve(process.env.UDS_DATA_DIR ?? join(process.env.LOCALAPPDATA ?? process.env.HOME ?? process.cwd(), "UnifiedDesignStudio"));
const databasePath = join(dataRoot, "studio.sqlite");

function textResult(value: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] };
}

function projectDocument(db: DatabaseSync, projectId: string) {
  const project = db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE id = ? AND archived_at IS NULL").get(projectId) as { id: string; name: string; updatedAt: string } | undefined;
  if (!project) throw new Error("Project not found or archived.");
  const row = db.prepare("SELECT d.id AS documentId, d.name AS documentName, d.current_revision AS revision, r.snapshot_json AS snapshot FROM documents d JOIN document_revisions r ON r.document_id = d.id AND r.revision = d.current_revision WHERE d.project_id = ? ORDER BY d.updated_at DESC LIMIT 1").get(projectId) as { documentId: string; documentName: string; revision: number; snapshot: string } | undefined;
  if (!row) throw new Error("Project has no saved document yet.");
  let input: unknown;
  try { input = JSON.parse(row.snapshot) as unknown; }
  catch { throw new Error("The saved project document is not valid JSON."); }
  const parsed = DesignDocumentSchema.safeParse(input);
  if (!parsed.success) throw new Error("The saved project document does not pass the design schema.");
  return { project, row, document: parsed.data };
}

function flatten(nodes: DesignNode[]): DesignNode[] {
  return nodes.flatMap(node => [node, ...( "children" in node ? flatten(node.children) : [])]);
}

function nodeSummary(node: DesignNode) {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked,
    x: node.x,
    y: node.y,
    ...( "width" in node ? { width: node.width, height: node.height } : {}),
    ...(node.type === "text" ? { text: node.text.slice(0, 500), color: node.color, fontSize: node.fontSize } : {}),
    ...(node.type === "shape" ? { shape: node.shape, fill: node.fill } : {}),
    ...(node.type === "image" ? { alt: node.alt, fit: node.fit } : {}),
  };
}

serveStdio(() => {
  if (!existsSync(databasePath)) throw new Error(`Unified Design Studio data was not found at ${databasePath}. Start the local Studio once, or set UDS_DATA_DIR to its data folder.`);
  const db = new DatabaseSync(databasePath, { timeout: 5_000 });
  db.exec("PRAGMA foreign_keys = ON;");
  const server = new McpServer({ name: "unified-design-studio", version: "0.1.0" }, { maxToolInputElements: 200 });

  server.registerTool("list_projects", {
    title: "List Studio projects",
    description: "List recent non-archived Unified Design Studio projects. Returns names, IDs, and update times only.",
    inputSchema: { limit: z.number().int().min(1).max(50).optional().describe("Maximum number of projects to return (1–50). Defaults to 20.") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ limit }) => {
    const projects = db.prepare("SELECT id, name, updated_at AS updatedAt FROM projects WHERE archived_at IS NULL ORDER BY updated_at DESC LIMIT ?").all(limit ?? 20);
    return textResult({ projects });
  });

  server.registerTool("get_project_summary", {
    title: "Get Studio project summary",
    description: "Read a saved project's page, layer, token, and component counts. The full document and asset contents are not returned.",
    inputSchema: { projectId: z.string().uuid().describe("The project ID returned by list_projects.") },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ projectId }) => {
    const { project, row, document } = projectDocument(db, projectId);
    const pages = document.pages.map(page => {
      const nodes = flatten(page.children);
      const counts = nodes.reduce<Record<string, number>>((result, node) => { result[node.type] = (result[node.type] ?? 0) + 1; return result; }, {});
      return { id: page.id, name: page.name, layerCount: nodes.length, layerTypes: counts };
    });
    return textResult({
      project,
      document: { id: row.documentId, name: row.documentName, revision: row.revision, pageCount: pages.length, pages },
      designSystem: { themes: document.designSystem.themes.length, modes: document.designSystem.modes.length, tokens: document.designSystem.tokens.length, components: document.designSystem.components.length },
      prototype: { variables: document.prototype.variables.length, connections: document.prototype.connections.length },
    });
  });

  server.registerTool("get_node_summaries", {
    title: "Get saved layer summaries",
    description: "Read up to 50 named layer summaries from a saved page. Text is truncated; binary assets, local paths, provider credentials, and prototype payloads are never returned.",
    inputSchema: {
      projectId: z.string().uuid().describe("The project ID returned by list_projects."),
      pageId: z.string().min(1).max(128).describe("The page ID returned by get_project_summary."),
      nodeIds: z.array(z.string().min(1).max(128)).min(1).max(50).describe("Layer IDs to read, with at most 50 IDs."),
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ projectId, pageId, nodeIds }) => {
    const { document } = projectDocument(db, projectId);
    const page = document.pages.find(item => item.id === pageId);
    if (!page) throw new Error("Page not found in this project.");
    const nodes = new Map(flatten(page.children).map(node => [node.id, node]));
    return textResult({ nodes: [...new Set(nodeIds)].map(id => nodes.get(id)).filter((node): node is DesignNode => Boolean(node)).map(nodeSummary) });
  });

  const mapCommandError = (error: unknown) => {
    const details = error instanceof DocumentCommandError
      ? { error: error.message, code: error.code, ...(error.currentRevision === undefined ? {} : { currentRevision: error.currentRevision }) }
      : { error: "The requested layer edit could not be saved." };
    return { ...textResult(details), isError: true };
  };

  server.registerTool("set_layer_text", {
    title: "Set text on a saved layer (modifies project)",
    description: "MODIFIES the saved project and creates a revision. The host should show this write and obtain user approval before calling it. Changes only the text field of one existing text layer on the specified page; it cannot create, delete, or move layers. Requires the current revision from get_project_summary.",
    inputSchema: {
      projectId: z.string().uuid().describe("The project ID returned by list_projects."),
      pageId: z.string().min(1).max(128).describe("The page ID returned by get_project_summary."),
      nodeId: z.string().min(1).max(128).describe("The existing text layer ID returned by get_node_summaries."),
      expectedRevision: z.number().int().min(0).describe("The current document revision from get_project_summary; stale revisions are rejected."),
      text: z.string().max(5_000).describe("Replacement text, up to 5,000 characters."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ projectId, pageId, nodeId, expectedRevision, text }) => {
    try {
      const { document } = projectDocument(db, projectId);
      if (document.revision !== expectedRevision) throw new DocumentCommandError("revision_conflict", "The project changed since it was read. Refresh its summary before editing.", document.revision);
      const candidate = applyLayerCommand(document, { type: "set_text", pageId, nodeId, text });
      const saved = saveDocumentRevision(db, projectId, candidate, expectedRevision, `MCP updated text layer ${nodeId}`);
      return textResult({ changed: saved.revision !== expectedRevision, projectId, pageId, nodeId, revision: saved.revision });
    } catch (error) { return mapCommandError(error); }
  });

  server.registerTool("rename_layer", {
    title: "Rename a saved layer (modifies project)",
    description: "MODIFIES the saved project and creates a revision. The host should show this write and obtain user approval before calling it. Changes only the name of one existing layer on the specified page; it cannot create, delete, or move layers. Requires the current revision from get_project_summary.",
    inputSchema: {
      projectId: z.string().uuid().describe("The project ID returned by list_projects."),
      pageId: z.string().min(1).max(128).describe("The page ID returned by get_project_summary."),
      nodeId: z.string().min(1).max(128).describe("The existing layer ID returned by get_node_summaries."),
      expectedRevision: z.number().int().min(0).describe("The current document revision from get_project_summary; stale revisions are rejected."),
      name: z.string().trim().min(1).max(80).describe("Replacement layer name, up to 80 characters."),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ projectId, pageId, nodeId, expectedRevision, name }) => {
    try {
      const { document } = projectDocument(db, projectId);
      if (document.revision !== expectedRevision) throw new DocumentCommandError("revision_conflict", "The project changed since it was read. Refresh its summary before editing.", document.revision);
      const candidate = applyLayerCommand(document, { type: "rename_layer", pageId, nodeId, name: name.trim() });
      const saved = saveDocumentRevision(db, projectId, candidate, expectedRevision, `MCP renamed layer ${nodeId}`);
      return textResult({ changed: saved.revision !== expectedRevision, projectId, pageId, nodeId, revision: saved.revision });
    } catch (error) { return mapCommandError(error); }
  });

  server.server.onclose = () => db.close();
  return server;
});
