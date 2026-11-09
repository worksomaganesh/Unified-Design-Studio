import { z } from "zod";

const id = z.string().min(1);
const layout = z.discriminatedUnion("display", [
  z.object({ display: z.literal("block") }),
  z.object({ display: z.literal("flex"), direction: z.enum(["row", "column"]).default("row"), gap: z.number().nonnegative().default(0), align: z.enum(["start", "center", "end", "stretch"]).default("stretch"), justify: z.enum(["start", "center", "end", "space-between"]).default("start") }),
  z.object({ display: z.literal("grid"), columns: z.array(z.string()).min(1), gap: z.number().nonnegative().default(0) }),
]);
const base = { id, name: z.string().default(""), visible: z.boolean().default(true), locked: z.boolean().default(false) };
const node: z.ZodType<any> = z.lazy(() => z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("frame"), width: z.number().positive(), height: z.number().positive(), children: z.array(node).default([]) }),
  z.object({ ...base, type: z.literal("container"), layout, children: z.array(node).default([]) }),
  z.object({ ...base, type: z.literal("text"), text: z.string(), color: z.string().default("#111827"), fontSize: z.number().positive().default(16) }),
  z.object({ ...base, type: z.literal("image"), src: z.string().min(1), alt: z.string().default(""), fit: z.enum(["cover", "contain"]).default("cover") }),
  z.object({ ...base, type: z.literal("shape"), shape: z.enum(["rectangle", "ellipse", "line"]), fill: z.string().default("#e5e7eb"), width: z.number().nonnegative(), height: z.number().nonnegative() }),
  z.object({ ...base, type: z.literal("component-instance"), componentId: id, overrides: z.record(z.unknown()).default({}) }),
]));
export const DesignNodeSchema = node;
export type DesignNode = z.infer<typeof DesignNodeSchema>;
export const DesignDocumentSchema = z.object({
  schemaVersion: z.literal(1), documentId: id, revision: z.number().int().nonnegative(),
  metadata: z.object({ name: z.string(), createdAt: z.string(), updatedAt: z.string() }),
  pages: z.array(z.object({ id, name: z.string(), children: z.array(DesignNodeSchema) })).min(1),
});
export type DesignDocument = z.infer<typeof DesignDocumentSchema>;

export function validateDocument(input: unknown): DesignDocument { return DesignDocumentSchema.parse(input); }

export function migrateDocument(input: unknown): DesignDocument {
  if (!input || typeof input !== "object") throw new Error("Document must be an object");
  const value = input as Record<string, unknown>;
  if (value.schemaVersion === 1) return validateDocument(value);
  throw new Error(`No migration path from schema version ${String(value.schemaVersion)}`);
}
