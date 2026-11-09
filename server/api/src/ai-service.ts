import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { DesignDocumentSchema, type DesignDocument, type DesignNode } from "@uds/design-core";
import {
  AIProviderIdSchema,
  FlowPlanSchema,
  GeneratedDirectionsSchema,
  PatchProposalSchema,
  documentSummary,
  generationInstruction,
  planInstruction,
  revisionInstruction,
  evaluateDirection,
  type AIProviderId,
  type ProviderImage,
} from "@uds/ai-engine";
import { providerAdapters, providerDefaultModel } from "./ai-providers.js";
import { deleteProviderCredential, getProviderCredential, hasProviderCredential, storeProviderCredential } from "./secure-credentials.js";

type Database = DatabaseSync;
type ProjectRoot = (projectId: string) => { root_path: string } | undefined;
type Settings = { theme: string; recentProjectLimit: number; selectedProvider: string };
type AIRequest = { document: unknown; prompt?: string; model?: string; screenCount?: number; directionCount?: number; referenceAssetIds?: string[] };
const modelId = z.string().trim().min(1).max(160).regex(/^[\w.:-]+$/);
const promptText = z.string().trim().min(3).max(10_000);
const credentialBody = z.object({ apiKey: z.string().trim().min(8).max(512) });
const providerBody = z.object({ provider: z.union([AIProviderIdSchema, z.literal("none")]) });
const planBody = z.object({ document: z.unknown(), prompt: promptText, model: modelId.optional(), screenCount: z.number().int().min(2).max(8).default(3), referenceAssetIds: z.array(z.string().min(1)).max(3).default([]) });
const generateBody = z.object({ document: z.unknown(), prompt: promptText, model: modelId.optional(), plan: FlowPlanSchema, directionCount: z.number().int().min(2).max(3).default(2), referenceAssetIds: z.array(z.string().min(1)).max(3).default([]) });
const reviseBody = z.object({ document: z.unknown(), prompt: promptText, model: modelId.optional(), pageId: z.string().min(1), selectedNodeIds: z.array(z.string().min(1)).min(1).max(20) });

function workspaceSettings(db: Database): Settings {
  const row = db.prepare("SELECT value_json AS value FROM workspace_settings WHERE key = 'workspace'").get() as { value: string } | undefined;
  return row ? JSON.parse(row.value) as Settings : { theme: "system", recentProjectLimit: 12, selectedProvider: "none" };
}

function isSameStudioRequest(request: FastifyRequest): boolean {
  const site = request.headers["sec-fetch-site"];
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = request.headers.origin;
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    const loopbackHost = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(parsed.hostname.toLowerCase());
    const studioPort = new Set(["", "4318", "5173", "4173"]).has(parsed.port);
    return parsed.protocol === "http:" && loopbackHost && studioPort;
  }
  catch { return false; }
}

function rejectCrossSite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (isSameStudioRequest(request)) return false;
  void reply.code(403).send({ error: "Credential actions are allowed only from the local studio." });
  return true;
}

function extractJson(text: string): unknown {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try { return JSON.parse(clean); }
  catch { throw new Error("The provider response was not valid JSON. Try again with a shorter or clearer brief."); }
}

function findNodes(nodes: DesignNode[], visit: (node: DesignNode) => void): void {
  for (const node of nodes) {
    visit(node);
    if ("children" in node) findNodes(node.children, visit);
  }
}

function formatSelectedNodes(document: DesignDocument, pageId: string, ids: string[]): { summaries: Record<string, unknown>[]; nodes: Map<string, DesignNode> } {
  const page = document.pages.find(item => item.id === pageId);
  if (!page) throw new Error("Selected page is missing from the current document.");
  const all = new Map<string, DesignNode>();
  findNodes(page.children, node => all.set(node.id, node));
  const selected = [...new Set(ids)].map(id => all.get(id));
  if (selected.some(node => !node)) throw new Error("Selection contains a layer that is not on the selected page.");
  const valid = selected as DesignNode[];
  const summaries = valid.map(node => ({
    id: node.id,
    name: node.name,
    type: node.type,
    ...(node.type === "text" ? { text: node.text, color: node.color, fontSize: node.fontSize } : {}),
    ...(node.type === "shape" ? { shape: node.shape, fill: node.fill } : {}),
  }));
  return { summaries, nodes: new Map(valid.map(node => [node.id, node])) };
}

function validatePatchTargets(operations: ReturnType<typeof PatchProposalSchema.parse>["operations"], selected: Map<string, DesignNode>): void {
  for (const operation of operations) {
    const node = selected.get(operation.nodeId);
    if (!node) throw new Error("A proposed change targets a layer outside the selected set.");
    if (operation.op === "setText" && node.type !== "text") throw new Error("A proposed text edit targets a non-text layer.");
    if (operation.op === "setColor" && node.type !== "text") throw new Error("A proposed text-color edit targets a non-text layer.");
    if (operation.op === "setFill" && node.type !== "shape") throw new Error("A proposed fill edit targets a non-shape layer.");
    if (operation.op === "setFontSize" && node.type !== "text") throw new Error("A proposed size edit targets a non-text layer.");
  }
}

export function registerAIService(app: FastifyInstance, db: Database, projectRootFor: ProjectRoot): void {
  app.get("/api/ai/providers", async () => {
    const selectedProvider = workspaceSettings(db).selectedProvider;
    const providers = await Promise.all(Object.values(providerAdapters).map(async adapter => ({
      id: adapter.id,
      label: adapter.label,
      configured: await hasProviderCredential(adapter.id),
      model: providerDefaultModel(adapter.id),
      capabilities: adapter.capability,
    })));
    return { selectedProvider, providers, credentialStore: process.platform === "win32" ? "windows-credential-manager" : "environment" };
  });

  app.put<{ Body: unknown }>("/api/ai/provider", async (request, reply) => {
    if (rejectCrossSite(request, reply)) return;
    const parsed = providerBody.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Choose OpenAI, Anthropic, Google Gemini, or no provider." });
    const current = workspaceSettings(db);
    const next = { ...current, selectedProvider: parsed.data.provider };
    db.prepare("INSERT INTO workspace_settings (key, value_json, updated_at) VALUES ('workspace', ?, ?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json, updated_at=excluded.updated_at").run(JSON.stringify(next), new Date().toISOString());
    return { selectedProvider: next.selectedProvider };
  });

  app.put<{ Params: { provider: string }; Body: unknown }>("/api/ai/credentials/:provider", async (request, reply) => {
    if (rejectCrossSite(request, reply)) return;
    const provider = AIProviderIdSchema.safeParse(request.params.provider);
    const body = credentialBody.safeParse(request.body);
    if (!provider.success || !body.success) return reply.code(400).send({ error: "Enter a valid provider API key." });
    try { await storeProviderCredential(provider.data, body.data.apiKey); }
    catch (error) { return reply.code(501).send({ error: (error as Error).message }); }
    return { configured: true, provider: provider.data };
  });

  app.delete<{ Params: { provider: string } }>("/api/ai/credentials/:provider", async (request, reply) => {
    if (rejectCrossSite(request, reply)) return;
    const provider = AIProviderIdSchema.safeParse(request.params.provider);
    if (!provider.success) return reply.code(400).send({ error: "Choose a supported AI provider." });
    try { await deleteProviderCredential(provider.data); }
    catch (error) { return reply.code(501).send({ error: (error as Error).message }); }
    return { configured: await hasProviderCredential(provider.data), provider: provider.data };
  });

  async function parseDocument(projectId: string, raw: unknown, reply: FastifyReply): Promise<DesignDocument | undefined> {
    const parsed = DesignDocumentSchema.safeParse(raw);
    if (!parsed.success) { reply.code(400).send({ error: "Document did not match the design schema.", issues: parsed.error.issues.slice(0, 8).map(issue => ({ path: issue.path.join("."), message: issue.message })) }); return undefined; }
    const document = parsed.data;
    const owner = db.prepare("SELECT project_id FROM documents WHERE id = ?").get(document.documentId) as { project_id: string } | undefined;
    if (!owner || owner.project_id !== projectId) { reply.code(404).send({ error: "Document does not belong to this project." }); return undefined; }
    const current = db.prepare("SELECT current_revision FROM documents WHERE id = ? AND project_id = ?").get(document.documentId, projectId) as { current_revision: number } | undefined;
    if (!current || document.revision !== current.current_revision) { reply.code(409).send({ error: "Document revision changed while this request was being prepared. Reload and try again." }); return undefined; }
    return document;
  }

  function revisionIsCurrent(document: DesignDocument, projectId: string): boolean {
    const current = db.prepare("SELECT current_revision FROM documents WHERE id = ? AND project_id = ?").get(document.documentId, projectId) as { current_revision: number } | undefined;
    return Boolean(current && current.current_revision === document.revision);
  }

  async function selectedAdapter(modelInput: string | undefined, reply: FastifyReply): Promise<{ id: AIProviderId; model: string; key: string } | undefined> {
    const selected = workspaceSettings(db).selectedProvider;
    const id = AIProviderIdSchema.safeParse(selected);
    if (!id.success) { reply.code(400).send({ error: "Choose an AI provider in the AI Studio panel first." }); return undefined; }
    const key = await getProviderCredential(id.data);
    if (!key) { reply.code(400).send({ error: `${providerAdapters[id.data].label} is not connected. Add its key in AI Studio.` }); return undefined; }
    const model = (modelInput || providerDefaultModel(id.data)).trim();
    if (!model || !modelId.safeParse(model).success) { reply.code(400).send({ error: "Enter a valid model ID or set the provider model in the local service environment." }); return undefined; }
    return { id: id.data, model, key };
  }

  async function loadImages(projectId: string, rootPath: string, ids: string[], reply: FastifyReply): Promise<ProviderImage[] | undefined> {
    const unique = [...new Set(ids)];
    if (unique.length > 3) { reply.code(400).send({ error: "Choose up to three reference images." }); return undefined; }
    const images: ProviderImage[] = [];
    let totalSize = 0;
    const mimeTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    for (const id of unique) {
      const record = db.prepare("SELECT relative_path, mime_type, original_name, byte_size FROM assets WHERE id = ? AND project_id = ?").get(id, projectId) as { relative_path: string; mime_type: string; original_name: string; byte_size: number } | undefined;
      if (!record || !mimeTypes.has(record.mime_type)) { reply.code(400).send({ error: "A selected reference image is missing or unsupported." }); return undefined; }
      totalSize += record.byte_size;
      if (record.byte_size > 4 * 1024 * 1024 || totalSize > 8 * 1024 * 1024) { reply.code(413).send({ error: "Reference images must total 8 MB or less." }); return undefined; }
      const path = resolve(rootPath, record.relative_path);
      if (!path.startsWith(resolve(rootPath) + sep)) { reply.code(400).send({ error: "A reference image path is invalid." }); return undefined; }
      let bytes: Buffer;
      try { bytes = readFileSync(path); }
      catch { reply.code(404).send({ error: "A selected reference image is unavailable." }); return undefined; }
      images.push({ mimeType: record.mime_type as ProviderImage["mimeType"], name: record.original_name.slice(0, 120), base64: bytes.toString("base64") });
    }
    return images;
  }

  async function providerGenerate(provider: { id: AIProviderId; model: string; key: string }, instruction: string, prompt: string, images: ProviderImage[]) {
    return providerAdapters[provider.id].generate({ model: provider.model, instruction, prompt, images }, provider.key);
  }

  app.post<{ Params: { id: string }; Body: AIRequest }>("/api/projects/:id/ai/plan", { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const parsedBody = planBody.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ error: "Check the brief, screen count, and reference image selection." });
    const document = await parseDocument(request.params.id, parsedBody.data.document, reply);
    if (!document) return;
    const project = projectRootFor(request.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found." });
    const images = await loadImages(request.params.id, project.root_path, parsedBody.data.referenceAssetIds, reply);
    if (!images) return;
    const provider = await selectedAdapter(parsedBody.data.model, reply);
    if (!provider) return;
    try {
      const prompt = `PRODUCT BRIEF\n${parsedBody.data.prompt}\n\nREQUESTED SCREENS: exactly ${parsedBody.data.screenCount}.\n\nCURRENT PROJECT CONTEXT (JSON)\n${documentSummary(document)}\n\nReturn a flow array and a screen inventory. Connect each user-flow step with nextStepIds. Give every screen a clear user goal and primary action.`;
      const plan = FlowPlanSchema.parse(extractJson(await providerGenerate(provider, planInstruction(), prompt, images)));
      if (!revisionIsCurrent(document, request.params.id)) return reply.code(409).send({ error: "Document revision changed while the flow was being planned. Review the current document and try again." });
      if (plan.screens.length !== parsedBody.data.screenCount) return reply.code(502).send({ error: `The provider returned ${plan.screens.length} screens; ${parsedBody.data.screenCount} were requested. Try again.` });
      return { plan, provider: provider.id, model: provider.model, baseRevision: document.revision };
    } catch (error) { return reply.code(502).send({ error: (error as Error).message }); }
  });

  app.post<{ Params: { id: string }; Body: AIRequest }>("/api/projects/:id/ai/generate", { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const parsedBody = generateBody.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ error: "Check the approved screen plan and generation options." });
    const document = await parseDocument(request.params.id, parsedBody.data.document, reply);
    if (!document) return;
    const project = projectRootFor(request.params.id);
    if (!project) return reply.code(404).send({ error: "Project not found." });
    const images = await loadImages(request.params.id, project.root_path, parsedBody.data.referenceAssetIds, reply);
    if (!images) return;
    const provider = await selectedAdapter(parsedBody.data.model, reply);
    if (!provider) return;
    try {
      const prompt = `PRODUCT BRIEF\n${parsedBody.data.prompt}\n\nAPPROVED FLOW AND SCREEN INVENTORY (JSON)\n${JSON.stringify(parsedBody.data.plan)}\n\nCreate exactly ${parsedBody.data.directionCount} distinct design directions with different layout values. Each direction must contain exactly ${parsedBody.data.plan.screens.length} screens, in the same order, with matching goals and names copied from the approved inventory. Keep content desktop-first, concise, and coherent. Return JSON only.`;
      const directions = GeneratedDirectionsSchema.parse(extractJson(await providerGenerate(provider, generationInstruction(), prompt, images)));
      if (!revisionIsCurrent(document, request.params.id)) return reply.code(409).send({ error: "Document revision changed while screens were being generated. Review the current document and try again." });
      if (directions.length !== parsedBody.data.directionCount) return reply.code(502).send({ error: `The provider returned ${directions.length} directions; ${parsedBody.data.directionCount} were requested. Try again.` });
      const mismatch = directions.find(direction => direction.screens.length !== parsedBody.data.plan.screens.length);
      if (mismatch) return reply.code(502).send({ error: `Direction “${mismatch.name}” did not match the approved screen count. Try again.` });
      const aligned = directions.map(direction => ({ ...direction, screens: direction.screens.map((screen, index) => ({ ...screen, name: parsedBody.data.plan.screens[index].name, goal: parsedBody.data.plan.screens[index].goal })) }));
      return { directions: aligned.map(direction => ({ ...direction, quality: evaluateDirection(direction) })), provider: provider.id, model: provider.model, baseRevision: document.revision };
    } catch (error) { return reply.code(502).send({ error: (error as Error).message }); }
  });

  app.post<{ Params: { id: string }; Body: AIRequest & { pageId?: string; selectedNodeIds?: string[] } }>("/api/projects/:id/ai/revise", { bodyLimit: 4 * 1024 * 1024 }, async (request, reply) => {
    const parsedBody = reviseBody.safeParse(request.body);
    if (!parsedBody.success) return reply.code(400).send({ error: "Select one or more layers and enter a revision request." });
    const document = await parseDocument(request.params.id, parsedBody.data.document, reply);
    if (!document) return;
    let selection: ReturnType<typeof formatSelectedNodes>;
    try { selection = formatSelectedNodes(document, parsedBody.data.pageId, parsedBody.data.selectedNodeIds); }
    catch (error) { return reply.code(400).send({ error: (error as Error).message }); }
    const provider = await selectedAdapter(parsedBody.data.model, reply);
    if (!provider) return;
    try {
      const prompt = `USER REVISION REQUEST\n${parsedBody.data.prompt}\n\nDOCUMENT SUMMARY\n${documentSummary(document)}\n\nONLY THESE SELECTED LAYERS MAY CHANGE\n${JSON.stringify(selection.summaries)}\n\nReturn a review summary, considerations, and a short list of supported operations. Do not include unchanged fields.`;
      const proposal = PatchProposalSchema.parse(extractJson(await providerGenerate(provider, revisionInstruction(), prompt, [])));
      validatePatchTargets(proposal.operations, selection.nodes);
      if (!revisionIsCurrent(document, request.params.id)) return reply.code(409).send({ error: "Document revision changed while the review was drafted. Review the current document and try again." });
      return { proposal, provider: provider.id, model: provider.model, baseRevision: document.revision };
    } catch (error) { return reply.code(502).send({ error: (error as Error).message }); }
  });
}
