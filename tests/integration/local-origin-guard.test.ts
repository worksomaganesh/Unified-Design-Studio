import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { isAllowedLocalStudioOrigin, registerLocalMutationOriginGuard } from "../../server/api/src/request-origin.ts";

const apiRequire = createRequire(new URL("../../server/api/package.json", import.meta.url));
const Fastify = apiRequire("fastify").default ?? apiRequire("fastify");

test("production API registers the origin guard before route handlers", () => {
  const entrypoint = readFileSync(new URL("../../server/api/src/index.ts", import.meta.url), "utf8");
  const guardIndex = entrypoint.indexOf("registerLocalMutationOriginGuard(app)");
  const firstRouteIndex = entrypoint.indexOf('app.get("/api/health"');
  assert.notEqual(guardIndex, -1);
  assert.notEqual(firstRouteIndex, -1);
  assert.ok(guardIndex < firstRouteIndex, "guard must be registered before API routes");
});

test("local Studio origin policy accepts only expected loopback origins and Fetch Metadata", () => {
  for (const origin of ["http://localhost:5173", "http://127.0.0.1:4318", "http://[::1]:4173", "http://localhost"]) {
    assert.equal(isAllowedLocalStudioOrigin(origin, "same-origin"), true, origin);
  }
  assert.equal(isAllowedLocalStudioOrigin("http://localhost:5173", "same-site"), true, "an allow-listed UI origin may call the local API across ports");
  for (const [origin, site] of [
    [undefined, undefined],
    ["https://localhost:5173", "same-origin"],
    ["http://example.com", "same-origin"],
    ["http://localhost:80", "same-origin"],
    ["http://localhost:5173/", "same-origin"],
    ["http://localhost:5173", "cross-site"],
    ["http://user@localhost:5173", "same-origin"],
    ["http://localhost:5173", "none-restricted"],
    ["http://localhost:9999", "same-site"],
  ] as const) {
    assert.equal(isAllowedLocalStudioOrigin(origin, site), false, `${origin} (${site})`);
  }
});

test("state-changing HTTP requests require a local Studio origin while reads remain available", async () => {
  const app = Fastify();
  registerLocalMutationOriginGuard(app);
  for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
    app.route({ method, url: "/mutation", handler: async () => ({ changed: true }) });
  }
  app.get("/read", async () => ({ readable: true }));
  try {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"] as const) {
      const blocked = await app.inject({ method, url: "/mutation", payload: { name: "No origin" } });
      assert.equal(blocked.statusCode, 403, `${method} without Origin`);

      if (method === "POST") {
        const malformed = await app.inject({ method, url: "/mutation", headers: { "content-type": "application/json" }, payload: "{" });
        assert.equal(malformed.statusCode, 403, "request-origin rejection runs before malformed JSON parsing");
      }

      const crossSite = await app.inject({ method, url: "/mutation", headers: { origin: "https://attacker.example", "sec-fetch-site": "cross-site" }, payload: { name: "No" } });
      assert.equal(crossSite.statusCode, 403, `${method} from an untrusted origin`);

      const local = await app.inject({ method, url: "/mutation", headers: { origin: "http://localhost:5173", "sec-fetch-site": "same-origin" }, payload: { name: "Yes" } });
      assert.equal(local.statusCode, 200, `${method} from the local Studio`);
      assert.deepEqual(local.json(), { changed: true });
    }

    const read = await app.inject({ method: "GET", url: "/read" });
    assert.equal(read.statusCode, 200);
    assert.deepEqual(read.json(), { readable: true });
  } finally { await app.close(); }
});
