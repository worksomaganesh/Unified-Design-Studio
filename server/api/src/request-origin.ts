import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

const localStudioPorts = new Set(["", "4318", "5173", "4173"]);
const localStudioHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** Allows only the HTTP loopback origins used by the local Studio and its Vite preview. */
export function isAllowedLocalStudioOrigin(origin: unknown, fetchSite: unknown): boolean {
  // The Origin must still match this exact allowlist; same-site alone is never trusted.
  // It supports a direct local Studio-to-API request across loopback ports.
  if (fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "same-site" && fetchSite !== "none") return false;
  if (typeof origin !== "string" || origin.length > 512) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== "http:" || parsed.username || parsed.password) return false;
    return localStudioHosts.has(parsed.hostname.toLowerCase()) && localStudioPorts.has(parsed.port);
  } catch { return false; }
}

export function isLocalStudioRequest(request: Pick<FastifyRequest, "headers">): boolean {
  return isAllowedLocalStudioOrigin(request.headers.origin, request.headers["sec-fetch-site"]);
}

export function rejectCrossSite(request: FastifyRequest, reply: FastifyReply): boolean {
  if (isLocalStudioRequest(request)) return false;
  void reply.code(403).send({ error: "State-changing requests are allowed only from the local studio." });
  return true;
}

export function registerLocalMutationOriginGuard(app: FastifyInstance): void {
  // Run before body parsing so rejected uploads cannot consume multipart work first.
  app.addHook("onRequest", async (request, reply) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method) && rejectCrossSite(request, reply)) return reply;
  });
}
