# IP / Location on Work Items Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record the client IP and resolved city/country on every newly created work item, and show it only to whitelisted org owners/managers in the org member view.

**Architecture:** Three nullable columns on `WorkItem` are hidden from every Prisma query by a global `omit`. Exactly one repository query (member work items for the org view) opts back in, and only when the caller's email is in `LOCATION_WHITELIST`. The IP comes from the TCP peer (headers are trusted only with `TRUST_PROXY=true`). It's geocoded through ip-api.com with a 2s timeout and a 30-day `IpLocationCache` table. Capture is lazy: it only runs when a new item is actually created.

**Tech Stack:** Bun 1.4, Hono 4.12 (`hono/bun` `getConnInfo`), Prisma 6.19 + SQLite, `bun:test`, React 18 + Vite + Tailwind (web).

**Spec:** `docs/superpowers/specs/2026-09-24-ip-location-work-items-design.md`

## Global Constraints

- Branch: `feature/ip-location-work-items`. Commit after every task. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
- Work item columns: `ipAddress String?`, `location String?`, `locationSource String?` (`"trigger"` | `"manual"`)
- Cache model: `IpLocationCache { ip String @id, location String, cachedAt DateTime @default(now()) }`, TTL 30 days
- Geocoder: `http://ip-api.com/json/{ip}?fields=status,city,country`, timeout 2000 ms, never throws
- Env vars: `LOCATION_WHITELIST` (comma-separated emails, case-insensitive; empty means nobody) and `TRUST_PROXY` (`"true"` enables last-entry `X-Forwarded-For`)
- Never use the leftmost `X-Forwarded-For` entry
- Location fields must not appear in any API response except `GET /api/organisations/:orgId/members/:memberId/work-items` for a whitelisted caller
- Capture on: `GET /api/trigger/session/:slug`, `GET /api/trigger/:apiToken/:slug` (`trigger`), `POST /api/projects/:id/work-items` (`manual`). Not on stop, update or description appends
- Server tests: run from `packages/server` with `bun test`. The server `tsc` is already failing for unrelated reasons (pre-existing), so don't use it as a gate. Web gate: `bun run build` in `packages/web`
- Bun's `mock.module` replaces a module for the rest of the test run. Every test file that mocks a repository must mock **all** methods any service under test calls, and the full `bun test` suite must pass, not just the single file

## Review Focus

1. **Spoofed `X-Forwarded-For`** from an employee's `curl` while `TRUST_PROXY` is unset must be ignored in favour of the peer address. Pinned in Task 2.
2. **IPv4-mapped IPv6 peer addresses** (`::ffff:203.0.113.5`, as Bun reports on dual-stack sockets) must be normalised to `203.0.113.5` before the private check, the cache key and the geocode. Pinned in Task 2.
3. **ip-api.com hanging** must not hold the start button for more than about 2 s. The item is still created with `location: null`. Pinned in Task 4.
4. **Leak through ordinary endpoints**: `/api/status`, trigger responses and timesheets must never carry `ipAddress`/`location`/`locationSource`, even for a whitelisted user. Pinned in Task 1 (global omit integration test).
5. **Cache write failure** (e.g. two concurrent triggers from the same IP racing on the primary key) must still return the resolved location. Pinned in Task 4.

---

## File Structure

| File | Status | Responsibility |
|---|---|---|
| `packages/server/prisma/schema.prisma` | modify | new columns + `IpLocationCache` |
| `packages/server/prisma/migrations/<ts>_add_work_item_location/` | generated | migration |
| `packages/server/src/db.ts` | modify | `createPrismaClient`, `HIDE_LOCATION`, `SHOW_LOCATION` |
| `packages/server/src/db.test.ts` | create | integration test: omit hides fields; opt-in shows them |
| `packages/server/src/lib/client-ip.ts` | create | `normalizeIp`, `isPrivateIp`, `clientIpFrom`, `getClientIp` |
| `packages/server/src/lib/client-ip.test.ts` | create | unit tests |
| `packages/server/src/lib/whitelist.ts` | create | `isLocationWhitelisted` |
| `packages/server/src/lib/whitelist.test.ts` | create | unit tests |
| `packages/server/src/repositories/ip-location-cache.repository.ts` | create | cache get/save |
| `packages/server/src/services/geo.service.ts` | create | `createGeoService`, `geoService` |
| `packages/server/src/services/geo.service.test.ts` | create | unit tests (injected fetch + cache) |
| `packages/server/src/lib/location-capture.ts` | create | `LocationCapture` type, `captureLocation(c, source)` |
| `packages/server/src/repositories/work-item.repository.ts` | modify | `create` accepts capture fields; `findByUserAndDateRange` opt-in |
| `packages/server/src/services/trigger.service.ts` | modify | `startWork(userId, slug, capture?)` |
| `packages/server/src/services/trigger.service.test.ts` | modify | capture tests |
| `packages/server/src/routes/trigger.ts` | modify | pass lazy capture on start routes |
| `packages/server/src/services/work-item.service.ts` | modify | `createManual(..., capture?)` |
| `packages/server/src/services/work-item.service.test.ts` | create | capture tests |
| `packages/server/src/routes/work-items.ts` | modify | pass lazy capture on manual create |
| `packages/server/src/services/organisation.service.ts` | modify | `getMemberWorkItems(..., opts)` |
| `packages/server/src/routes/organisations.ts` | modify | whitelist decision |
| `packages/web/src/components/location-badge.tsx` | create | badge |
| `packages/web/src/pages/org-member-view.tsx` | modify | Location column |
| `packages/server/package.json`, `packages/server/.env.example`, `docker-compose.yml`, `README.md` | modify | test script, env vars, docs |

---

### Task 1: Schema, migration, hidden-by-default client

**Files:**
- Modify: `packages/server/prisma/schema.prisma` (`model WorkItem`, lines 126-138; add new model after it)
- Modify: `packages/server/src/db.ts`
- Modify: `packages/server/package.json` (scripts)
- Create: `packages/server/src/db.test.ts`

**Interfaces:**
- Produces: `createPrismaClient(datasourceUrl?: string): PrismaClient`, `prisma`, `HIDE_LOCATION`, `SHOW_LOCATION` (from `src/db.ts`); Prisma model `ipLocationCache`

- [ ] **Step 1: Add the test script.** In `packages/server/package.json` `scripts`, add:

```json
"test": "bun test"
```

- [ ] **Step 2: Edit the schema.** In `model WorkItem`, add after `description String?`:

```prisma
  ipAddress      String?
  location       String?
  locationSource String?
```

After the closing `}` of `model WorkItem`, add:

```prisma
model IpLocationCache {
  ip       String   @id
  location String
  cachedAt DateTime @default(now())
}
```

- [ ] **Step 3: Generate the migration and client** (run in `packages/server`):

Run: `bunx --bun prisma migrate dev --name add_work_item_location`
Expected: a new folder `prisma/migrations/*_add_work_item_location/` with `ALTER TABLE "WorkItem" ADD COLUMN` ×3 and `CREATE TABLE "IpLocationCache"`, plus "Generated Prisma Client".

- [ ] **Step 4: Write the failing integration test** `packages/server/src/db.test.ts`:

```ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrismaClient, SHOW_LOCATION } from "./db";

const dir = mkdtempSync(join(tmpdir(), "wt-db-test-"));
const url = `file:${join(dir, "test.db")}`;
let db: ReturnType<typeof createPrismaClient>;
let itemId: string;

beforeAll(async () => {
  const res = Bun.spawnSync(["bunx", "--bun", "prisma", "migrate", "deploy"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, DATABASE_URL: url },
  });
  if (res.exitCode !== 0) throw new Error(res.stderr.toString());

  db = createPrismaClient(url);
  await db.user.create({ data: { id: "u1", name: "U", email: "u1@example.com" } });
  const project = await db.project.create({ data: { slug: "p1", name: "P", userId: "u1" } });
  const item = await db.workItem.create({
    data: {
      projectId: project.id,
      userId: "u1",
      startedAt: new Date(),
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "trigger",
    },
  });
  itemId = item.id;
});

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("work item location fields", () => {
  test("are hidden by default, including on create results and includes", async () => {
    const plain = await db.workItem.findUnique({ where: { id: itemId } });
    const withProject = await db.workItem.findMany({ include: { project: true } });
    for (const obj of [plain, withProject[0]]) {
      expect(obj).not.toHaveProperty("ipAddress");
      expect(obj).not.toHaveProperty("location");
      expect(obj).not.toHaveProperty("locationSource");
    }
  });

  test("are returned when a query opts in with SHOW_LOCATION", async () => {
    const item = await db.workItem.findUnique({ where: { id: itemId }, omit: SHOW_LOCATION });
    expect(item).toMatchObject({
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "trigger",
    });
  });
});
```

- [ ] **Step 5: Run it to see it fail**

Run: `bun test src/db.test.ts`
Expected: FAIL, `createPrismaClient` is not exported.

- [ ] **Step 6: Implement** `packages/server/src/db.ts` (replace the whole file):

```ts
import { PrismaClient } from "@prisma/client";

/** Location columns are hidden from every WorkItem query unless a query opts in. */
export const HIDE_LOCATION = {
  ipAddress: true,
  location: true,
  locationSource: true,
} as const;

/** Pass as `omit` on a single query to include the location columns. */
export const SHOW_LOCATION = {
  ipAddress: false,
  location: false,
  locationSource: false,
} as const;

export function createPrismaClient(datasourceUrl?: string) {
  return new PrismaClient({
    omit: { workItem: HIDE_LOCATION },
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
}

export const prisma = createPrismaClient();
```

- [ ] **Step 7: Run the full suite**

Run: `bun test`
Expected: `db.test.ts` 2 pass, `trigger.service.test.ts` 7 pass, 0 fail. (A `tokio-runtime-worker panicked … JoinError::Cancelled` line printed after the summary is pre-existing Prisma shutdown noise and isn't a failure.)

- [ ] **Step 8: Commit**

```bash
git add packages/server/package.json packages/server/prisma packages/server/src/db.ts packages/server/src/db.test.ts
git commit -m "feat(server): add hidden location columns and IP cache table to work items"
```

---

### Task 2: Client IP extraction (spoof-proof)

**Files:**
- Create: `packages/server/src/lib/client-ip.ts`
- Create: `packages/server/src/lib/client-ip.test.ts`
- Modify: `packages/server/.env.example`, `docker-compose.yml` (server `environment`)

**Interfaces:**
- Produces: `normalizeIp(ip: string): string`, `isPrivateIp(ip: string): boolean`, `clientIpFrom(peer: string | null | undefined, xff: string | null | undefined, trustProxy: boolean): string | null`, `getClientIp(c: Context): string | null`

- [ ] **Step 1: Write the failing tests** `packages/server/src/lib/client-ip.test.ts`:

```ts
import { describe, test, expect } from "bun:test";
import { normalizeIp, isPrivateIp, clientIpFrom } from "./client-ip";

describe("normalizeIp", () => {
  test("unwraps IPv4-mapped IPv6", () => {
    expect(normalizeIp("::ffff:203.0.113.5")).toBe("203.0.113.5");
    expect(normalizeIp("::FFFF:10.0.0.1")).toBe("10.0.0.1");
  });
  test("trims and lowercases IPv6", () => {
    expect(normalizeIp("  2001:DB8::1 ")).toBe("2001:db8::1");
  });
  test("leaves plain IPv4 alone", () => {
    expect(normalizeIp("8.8.8.8")).toBe("8.8.8.8");
  });
});

describe("isPrivateIp", () => {
  test.each([
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1",
    "169.254.1.1", "100.64.0.1", "100.127.255.255", "0.0.0.0",
    "::1", "::", "fc00::1", "fd12:3456::1", "fe80::1", "febf::1",
    "::ffff:192.168.0.1", "not-an-ip", "",
  ])("%s is private/unroutable", (ip) => {
    expect(isPrivateIp(ip)).toBe(true);
  });

  test.each([
    "8.8.8.8", "172.15.0.1", "172.32.0.1", "100.63.255.255", "100.128.0.1",
    "203.0.113.5", "2001:4860:4860::8888", "::ffff:8.8.8.8",
  ])("%s is public", (ip) => {
    expect(isPrivateIp(ip)).toBe(false);
  });
});

describe("clientIpFrom", () => {
  test("uses the peer address by default", () => {
    expect(clientIpFrom("203.0.113.5", undefined, false)).toBe("203.0.113.5");
  });
  test("ignores a spoofed X-Forwarded-For when proxy is not trusted", () => {
    expect(clientIpFrom("203.0.113.5", "1.2.3.4", false)).toBe("203.0.113.5");
  });
  test("normalises an IPv4-mapped peer", () => {
    expect(clientIpFrom("::ffff:203.0.113.5", undefined, false)).toBe("203.0.113.5");
  });
  test("uses the LAST X-Forwarded-For entry when proxy is trusted", () => {
    expect(clientIpFrom("10.0.0.2", "1.2.3.4, 198.51.100.7", true)).toBe("198.51.100.7");
  });
  test("falls back to peer when trusted but header missing or blank", () => {
    expect(clientIpFrom("10.0.0.2", undefined, true)).toBe("10.0.0.2");
    expect(clientIpFrom("10.0.0.2", " , ", true)).toBe("10.0.0.2");
  });
  test("returns null when nothing is known", () => {
    expect(clientIpFrom(undefined, undefined, false)).toBeNull();
    expect(clientIpFrom("", undefined, false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test src/lib/client-ip.test.ts`
Expected: FAIL, cannot find module `./client-ip`.

- [ ] **Step 3: Implement** `packages/server/src/lib/client-ip.ts`:

```ts
import type { Context } from "hono";
import { getConnInfo } from "hono/bun";

export function normalizeIp(ip: string): string {
  const trimmed = ip.trim().toLowerCase();
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(trimmed);
  return mapped ? mapped[1] : trimmed;
}

function parseIpv4(ip: string): number[] | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return nums.every((n) => n >= 0 && n <= 255) ? nums : null;
}

/** True for loopback/private/link-local/CGNAT/ULA and anything unparseable (never geocode those). */
export function isPrivateIp(raw: string): boolean {
  const ip = normalizeIp(raw);
  const v4 = parseIpv4(ip);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  if (!ip.includes(":") || !/^[0-9a-f:]+$/.test(ip)) return true;
  if (ip === "::" || ip === "::1") return true;
  if (/^f[cd]/.test(ip)) return true; // fc00::/7
  if (/^fe[89ab]/.test(ip)) return true; // fe80::/10
  return false;
}

export function clientIpFrom(
  peer: string | null | undefined,
  xff: string | null | undefined,
  trustProxy: boolean
): string | null {
  if (trustProxy && xff) {
    const entries = xff.split(",").map((s) => s.trim()).filter(Boolean);
    const last = entries[entries.length - 1];
    if (last) return normalizeIp(last);
  }
  return peer && peer.trim() ? normalizeIp(peer) : null;
}

export function getClientIp(c: Context): string | null {
  let peer: string | undefined;
  try {
    peer = getConnInfo(c).remote.address;
  } catch {
    peer = undefined;
  }
  return clientIpFrom(
    peer,
    c.req.header("x-forwarded-for"),
    process.env.TRUST_PROXY === "true"
  );
}
```

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Document the env var.** Append to `packages/server/.env.example`:

```
# Only set to "true" when the server sits behind YOUR reverse proxy, which appends
# the client IP to X-Forwarded-For. Leave unset when the server is exposed directly,
# otherwise clients can fake their IP.
TRUST_PROXY=
```

In `docker-compose.yml`, under `services.server.environment`, add after the `CORS_ORIGIN` line:

```yaml
      - TRUST_PROXY=${TRUST_PROXY:-}
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/lib/client-ip.ts packages/server/src/lib/client-ip.test.ts packages/server/.env.example docker-compose.yml
git commit -m "feat(server): add spoof-resistant client IP extraction"
```

---

### Task 3: Whitelist helper

**Files:**
- Create: `packages/server/src/lib/whitelist.ts`
- Create: `packages/server/src/lib/whitelist.test.ts`
- Modify: `packages/server/.env.example`, `docker-compose.yml`

**Interfaces:**
- Produces: `isLocationWhitelisted(email: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing tests** `packages/server/src/lib/whitelist.test.ts`:

```ts
import { describe, test, expect, afterEach } from "bun:test";
import { isLocationWhitelisted } from "./whitelist";

const original = process.env.LOCATION_WHITELIST;
afterEach(() => {
  if (original === undefined) delete process.env.LOCATION_WHITELIST;
  else process.env.LOCATION_WHITELIST = original;
});

describe("isLocationWhitelisted", () => {
  test("nobody is whitelisted when the env var is unset or blank", () => {
    delete process.env.LOCATION_WHITELIST;
    expect(isLocationWhitelisted("boss@example.com")).toBe(false);
    process.env.LOCATION_WHITELIST = "  ";
    expect(isLocationWhitelisted("boss@example.com")).toBe(false);
  });

  test("matches trimmed, case-insensitive entries", () => {
    process.env.LOCATION_WHITELIST = " Boss@Example.com , hr@example.com,";
    expect(isLocationWhitelisted("boss@example.com")).toBe(true);
    expect(isLocationWhitelisted("  HR@EXAMPLE.COM ")).toBe(true);
    expect(isLocationWhitelisted("other@example.com")).toBe(false);
  });

  test("rejects empty/missing emails even if the list has an empty entry", () => {
    process.env.LOCATION_WHITELIST = "boss@example.com,,";
    expect(isLocationWhitelisted("")).toBe(false);
    expect(isLocationWhitelisted(null)).toBe(false);
    expect(isLocationWhitelisted(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test src/lib/whitelist.test.ts`
Expected: FAIL, cannot find module `./whitelist`.

- [ ] **Step 3: Implement** `packages/server/src/lib/whitelist.ts`:

```ts
/** Emails allowed to see work item IP/location. Read on every call so config changes and tests take effect. */
export function isLocationWhitelisted(email: string | null | undefined): boolean {
  const target = email?.trim().toLowerCase();
  if (!target) return false;
  const list = (process.env.LOCATION_WHITELIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(target);
}
```

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Document the env var.** Append to `packages/server/.env.example`:

```
# Comma-separated emails of org owners/managers allowed to see where members logged work.
# Employees must be informed of this monitoring before enabling it (GDPR).
LOCATION_WHITELIST=
```

In `docker-compose.yml` `services.server.environment`, add after the `TRUST_PROXY` line:

```yaml
      - LOCATION_WHITELIST=${LOCATION_WHITELIST:-}
```

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/lib/whitelist.ts packages/server/src/lib/whitelist.test.ts packages/server/.env.example docker-compose.yml
git commit -m "feat(server): add LOCATION_WHITELIST helper"
```

---

### Task 4: Geo service with cache and timeout

**Files:**
- Create: `packages/server/src/repositories/ip-location-cache.repository.ts`
- Create: `packages/server/src/services/geo.service.ts`
- Create: `packages/server/src/services/geo.service.test.ts`

**Interfaces:**
- Consumes: `isPrivateIp` (Task 2), `prisma.ipLocationCache` (Task 1)
- Produces: `interface LocationCache { get(ip: string): Promise<{ location: string; cachedAt: Date } | null>; save(ip: string, location: string): Promise<void> }`, `createGeoService(deps: { cache: LocationCache; fetchFn?: typeof fetch; now?: () => Date; timeoutMs?: number }): { resolveLocation(ip: string | null): Promise<string | null> }`, `geoService`, `CACHE_TTL_MS`

- [ ] **Step 1: Write the failing tests** `packages/server/src/services/geo.service.test.ts`:

```ts
import { describe, test, expect, mock } from "bun:test";
import { createGeoService, CACHE_TTL_MS, type LocationCache } from "./geo.service";

const NOW = new Date("2026-09-24T10:00:00Z");

function makeCache(entry: { location: string; cachedAt: Date } | null = null) {
  return {
    get: mock(async (_ip: string) => entry),
    save: mock(async (_ip: string, _loc: string) => {}),
  } satisfies LocationCache;
}

function jsonFetch(body: unknown) {
  return mock(async (_url: string | URL | Request, _init?: RequestInit) =>
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } })
  ) as unknown as typeof fetch & ReturnType<typeof mock>;
}

describe("resolveLocation", () => {
  test("returns null without any lookup for null or private IPs", async () => {
    const cache = makeCache();
    const fetchFn = jsonFetch({});
    const geo = createGeoService({ cache, fetchFn, now: () => NOW });
    expect(await geo.resolveLocation(null)).toBeNull();
    expect(await geo.resolveLocation("192.168.1.10")).toBeNull();
    expect(cache.get).not.toHaveBeenCalled();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("returns a fresh cache hit without calling the API", async () => {
    const cache = makeCache({ location: "Brno, Czechia", cachedAt: new Date(NOW.getTime() - 1000) });
    const fetchFn = jsonFetch({});
    const geo = createGeoService({ cache, fetchFn, now: () => NOW });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Brno, Czechia");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  test("refetches and re-saves a stale cache entry", async () => {
    const cache = makeCache({ location: "Old, Place", cachedAt: new Date(NOW.getTime() - CACHE_TTL_MS - 1) });
    const fetchFn = jsonFetch({ status: "success", city: "Prague", country: "Czechia" });
    const geo = createGeoService({ cache, fetchFn, now: () => NOW });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Prague, Czechia");
    expect(cache.save).toHaveBeenCalledWith("203.0.113.5", "Prague, Czechia");
  });

  test("calls ip-api with the expected URL and caches success", async () => {
    const cache = makeCache();
    const fetchFn = jsonFetch({ status: "success", city: "Prague", country: "Czechia" });
    const geo = createGeoService({ cache, fetchFn, now: () => NOW });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Prague, Czechia");
    expect(fetchFn.mock.calls[0][0]).toBe("http://ip-api.com/json/203.0.113.5?fields=status,city,country");
    expect(cache.save).toHaveBeenCalledTimes(1);
  });

  test("uses country alone when city is empty", async () => {
    const geo = createGeoService({
      cache: makeCache(),
      fetchFn: jsonFetch({ status: "success", city: "", country: "Czechia" }),
      now: () => NOW,
    });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Czechia");
  });

  test("returns null and does not cache on status fail", async () => {
    const cache = makeCache();
    const geo = createGeoService({ cache, fetchFn: jsonFetch({ status: "fail" }), now: () => NOW });
    expect(await geo.resolveLocation("203.0.113.5")).toBeNull();
    expect(cache.save).not.toHaveBeenCalled();
  });

  test("returns null when fetch throws or returns bad JSON", async () => {
    const throwing = mock(async () => { throw new Error("network down"); }) as unknown as typeof fetch;
    const badJson = mock(async () => new Response("<html>")) as unknown as typeof fetch;
    for (const fetchFn of [throwing, badJson]) {
      const geo = createGeoService({ cache: makeCache(), fetchFn, now: () => NOW });
      expect(await geo.resolveLocation("203.0.113.5")).toBeNull();
    }
  });

  test("gives up after the timeout instead of hanging", async () => {
    const hanging = mock(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    ) as unknown as typeof fetch;
    const geo = createGeoService({ cache: makeCache(), fetchFn: hanging, now: () => NOW, timeoutMs: 50 });
    const started = Date.now();
    expect(await geo.resolveLocation("203.0.113.5")).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });

  test("still returns the location when the cache write fails", async () => {
    const cache = makeCache();
    cache.save.mockImplementation(async () => { throw new Error("UNIQUE constraint failed"); });
    const geo = createGeoService({
      cache,
      fetchFn: jsonFetch({ status: "success", city: "Prague", country: "Czechia" }),
      now: () => NOW,
    });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Prague, Czechia");
  });

  test("treats a cache read failure as a miss", async () => {
    const cache = makeCache();
    cache.get.mockImplementation(async () => { throw new Error("db locked"); });
    const geo = createGeoService({
      cache,
      fetchFn: jsonFetch({ status: "success", city: "Prague", country: "Czechia" }),
      now: () => NOW,
    });
    expect(await geo.resolveLocation("203.0.113.5")).toBe("Prague, Czechia");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test src/services/geo.service.test.ts`
Expected: FAIL, cannot find module `./geo.service`.

- [ ] **Step 3: Implement the cache repository** `packages/server/src/repositories/ip-location-cache.repository.ts`:

```ts
import { prisma } from "../db";

export const ipLocationCacheRepository = {
  async get(ip: string) {
    return prisma.ipLocationCache.findUnique({
      where: { ip },
      select: { location: true, cachedAt: true },
    });
  },

  async save(ip: string, location: string) {
    await prisma.ipLocationCache.upsert({
      where: { ip },
      create: { ip, location },
      update: { location, cachedAt: new Date() },
    });
  },
};
```

- [ ] **Step 4: Implement the service** `packages/server/src/services/geo.service.ts`:

```ts
import { isPrivateIp } from "../lib/client-ip";
import { ipLocationCacheRepository } from "../repositories/ip-location-cache.repository";

// Provider: ip-api.com free endpoint (HTTP only, non-commercial licence; chosen by the owner).
// All provider-specific code lives in this file.
export const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_TIMEOUT_MS = 2000;

export interface LocationCache {
  get(ip: string): Promise<{ location: string; cachedAt: Date } | null>;
  save(ip: string, location: string): Promise<void>;
}

export function createGeoService(deps: {
  cache: LocationCache;
  fetchFn?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
}) {
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  async function lookup(ip: string): Promise<string | null> {
    const res = await fetchFn(
      `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,city,country`,
      { signal: AbortSignal.timeout(timeoutMs) }
    );
    const body = (await res.json()) as { status?: string; city?: string; country?: string };
    if (body.status !== "success") return null;
    const parts = [body.city, body.country].filter((p): p is string => !!p && p.trim() !== "");
    return parts.length ? parts.join(", ") : null;
  }

  return {
    /** Never throws. Returns "City, Country" or null. */
    async resolveLocation(ip: string | null): Promise<string | null> {
      if (!ip || isPrivateIp(ip)) return null;

      try {
        const cached = await deps.cache.get(ip);
        if (cached && now().getTime() - cached.cachedAt.getTime() < CACHE_TTL_MS) {
          return cached.location;
        }
      } catch {
        // cache unavailable: fall through to a live lookup
      }

      let location: string | null;
      try {
        location = await lookup(ip);
      } catch {
        return null;
      }
      if (location) {
        try {
          await deps.cache.save(ip, location);
        } catch {
          // e.g. concurrent insert race; the location is still valid
        }
      }
      return location;
    },
  };
}

export const geoService = createGeoService({ cache: ipLocationCacheRepository });
```

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/repositories/ip-location-cache.repository.ts packages/server/src/services/geo.service.ts packages/server/src/services/geo.service.test.ts
git commit -m "feat(server): add cached ip-api.com geolocation service with timeout"
```

---

### Task 5: Capture on start triggers

**Files:**
- Create: `packages/server/src/lib/location-capture.ts`
- Modify: `packages/server/src/repositories/work-item.repository.ts:63-71` (`create`)
- Modify: `packages/server/src/services/trigger.service.ts:15-65` (`startWork`)
- Modify: `packages/server/src/routes/trigger.ts` (the two `/:slug` routes)
- Modify: `packages/server/src/services/trigger.service.test.ts`

**Interfaces:**
- Consumes: `getClientIp` (Task 2), `geoService.resolveLocation` (Task 4)
- Produces: `type LocationSource = "trigger" | "manual"`, `type LocationCapture = { ipAddress: string | null; location: string | null; locationSource: LocationSource }`, `captureLocation(c: Context, source: LocationSource): Promise<LocationCapture>`, `triggerService.startWork(userId: string, slug: string, capture?: () => Promise<LocationCapture>)`, `workItemRepository.create(data & Partial<LocationCapture>)`

- [ ] **Step 1: Add failing tests** to `packages/server/src/services/trigger.service.test.ts`. Append a new `describe` at the end of the file. Reuse the file's existing mocks and constants (`mockFindBySlug`, `mockFindActiveByUser`, `mockCreate`, `USER_ID`, `PROJECT_ID`, `SLUG`):

```ts
describe("triggerService.startWork location capture", () => {
  const project = { id: PROJECT_ID, slug: SLUG, name: "My Project", userId: USER_ID };
  const captured = { ipAddress: "203.0.113.5", location: "Prague, Czechia", locationSource: "trigger" as const };

  test("stores the capture on a newly created work item", async () => {
    mockFindBySlug.mockResolvedValue(project as any);
    mockFindActiveByUser.mockResolvedValue(null);
    mockCreate.mockImplementation(async (data: any) => ({ id: "wi-new", ...data }) as any);
    const capture = mock(async () => captured);

    await triggerService.startWork(USER_ID, SLUG, capture);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      projectId: PROJECT_ID,
      userId: USER_ID,
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "trigger",
    });
  });

  test("does not capture when the same project is already active", async () => {
    mockFindBySlug.mockResolvedValue(project as any);
    mockFindActiveByUser.mockResolvedValue({
      id: "wi-1", projectId: PROJECT_ID, userId: USER_ID,
      startedAt: new Date(Date.now() - 60_000), endedAt: null, project,
    } as any);
    const capture = mock(async () => captured);

    await triggerService.startWork(USER_ID, SLUG, capture);

    expect(capture).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  test("does not capture when the project is not found", async () => {
    mockFindBySlug.mockResolvedValue(null);
    const capture = mock(async () => captured);

    expect(await triggerService.startWork(USER_ID, "nope", capture)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  test("still starts work when capture rejects", async () => {
    mockFindBySlug.mockResolvedValue(project as any);
    mockFindActiveByUser.mockResolvedValue(null);
    mockCreate.mockImplementation(async (data: any) => ({ id: "wi-new", ...data }) as any);
    const capture = mock(async () => { throw new Error("boom"); });

    const result = await triggerService.startWork(USER_ID, SLUG, capture);

    expect(result).not.toBeNull();
    expect(mockCreate.mock.calls[0][0]).not.toHaveProperty("ipAddress");
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test src/services/trigger.service.test.ts`
Expected: "stores the capture on a newly created work item" FAILS (capture is never called, and create isn't passed the fields). The three negative tests already pass, because today nothing calls `capture`. They're guards against regressions in Step 5. The 7 existing tests still pass.

- [ ] **Step 3: Create** `packages/server/src/lib/location-capture.ts`:

```ts
import type { Context } from "hono";
import { getClientIp } from "./client-ip";
import { geoService } from "../services/geo.service";

export type LocationSource = "trigger" | "manual";

export type LocationCapture = {
  ipAddress: string | null;
  location: string | null;
  locationSource: LocationSource;
};

/** Reads the client IP from the request and resolves it. Never throws. */
export async function captureLocation(c: Context, source: LocationSource): Promise<LocationCapture> {
  const ipAddress = getClientIp(c);
  const location = await geoService.resolveLocation(ipAddress);
  return { ipAddress, location, locationSource: source };
}

/** Runs a lazy capture; any failure yields no capture rather than failing the request. */
export async function runCapture(
  capture?: () => Promise<LocationCapture>
): Promise<Partial<LocationCapture>> {
  if (!capture) return {};
  try {
    return await capture();
  } catch {
    return {};
  }
}
```

- [ ] **Step 4: Extend the repository `create`** in `packages/server/src/repositories/work-item.repository.ts` (replace the `create` method):

```ts
  async create(data: {
    projectId: string;
    userId: string;
    startedAt: Date;
    endedAt?: Date;
    description?: string;
    ipAddress?: string | null;
    location?: string | null;
    locationSource?: string | null;
  }) {
    return prisma.workItem.create({ data });
  },
```

- [ ] **Step 5: Update `startWork`** in `packages/server/src/services/trigger.service.ts`. Add the import at the top:

```ts
import { runCapture, type LocationCapture } from "../lib/location-capture";
```

Change the signature line to:

```ts
  async startWork(userId: string, slug: string, capture?: () => Promise<LocationCapture>) {
```

Replace the `// Start new work item` block with:

```ts
    // Start new work item (capture runs only here, after the idempotent and not-found exits)
    const captured = await runCapture(capture);
    const newItem = await workItemRepository.create({
      projectId: project.id,
      userId,
      startedAt: new Date(),
      ...captured,
    });
```

Leave the audit log call after it unchanged.

- [ ] **Step 6: Wire the routes** in `packages/server/src/routes/trigger.ts`. Add the import:

```ts
import { captureLocation } from "../lib/location-capture";
```

In `trigger.get("/session/:slug", ...)`, replace the `startWork` call with:

```ts
  const workItem = await triggerService.startWork(userId, c.req.param("slug"), () =>
    captureLocation(c, "trigger")
  );
```

In `trigger.get("/:apiToken/:slug", ...)`, replace the `startWork` call with:

```ts
  const workItem = await triggerService.startWork(
    profile.userId,
    c.req.param("slug"),
    () => captureLocation(c, "trigger")
  );
```

The stop routes, the `PUT` and the description routes stay unchanged.

- [ ] **Step 7: Run the full suite**

Run: `bun test`
Expected: all pass (7 existing + 4 new trigger tests, plus earlier tasks).

- [ ] **Step 8: Commit**

```bash
git add packages/server/src/lib/location-capture.ts packages/server/src/repositories/work-item.repository.ts packages/server/src/services/trigger.service.ts packages/server/src/services/trigger.service.test.ts packages/server/src/routes/trigger.ts
git commit -m "feat(server): capture client IP and location when tracking starts"
```

---

### Task 6: Capture on manual entries

**Files:**
- Modify: `packages/server/src/services/work-item.service.ts` (`createManual`)
- Modify: `packages/server/src/routes/work-items.ts` (`POST /projects/:id/work-items`)
- Create: `packages/server/src/services/work-item.service.test.ts`

**Interfaces:**
- Consumes: `captureLocation`, `runCapture`, `LocationCapture` (Task 5), `workItemRepository.create` with capture fields (Task 5)
- Produces: `workItemService.createManual(projectId, userId, startedAt, endedAt, description?, capture?: () => Promise<LocationCapture>)`

- [ ] **Step 1: Write the failing test** `packages/server/src/services/work-item.service.test.ts`:

```ts
import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock EVERY method the trigger and work-item services use (bun mocks are process-wide).
const mockFindById = mock(async (_id: string) => null as any);
const mockFindBySlug = mock(async (_slug: string) => null as any);
const mockCreate = mock(async (data: any) => ({ id: "wi-new", ...data }));
const mockFindOverlapping = mock(async () => null as any);

mock.module("../repositories/project.repository", () => ({
  projectRepository: { findById: mockFindById, findBySlug: mockFindBySlug },
}));
mock.module("../repositories/work-item.repository", () => ({
  workItemRepository: {
    create: mockCreate,
    findOverlapping: mockFindOverlapping,
    findActiveByUser: mock(async () => null),
    findById: mock(async () => null),
    update: mock(async () => null),
    delete: mock(async () => null),
  },
}));
mock.module("./audit-log.service", () => ({
  auditLogService: { log: mock(() => {}) },
  AuditAction: new Proxy({}, { get: (_t, k) => String(k) }),
  EntityType: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const { workItemService } = await import("./work-item.service");

const USER_ID = "user-1";
const PROJECT = { id: "proj-1", userId: USER_ID, slug: "p", name: "P" };
const START = "2026-09-24T08:00:00.000Z";
const END = "2026-09-24T09:00:00.000Z";

beforeEach(() => {
  mockFindById.mockReset();
  mockCreate.mockClear();
  mockFindOverlapping.mockReset();
  mockFindOverlapping.mockResolvedValue(null);
});

describe("workItemService.createManual location capture", () => {
  test("stores the capture with locationSource manual", async () => {
    mockFindById.mockResolvedValue(PROJECT);
    const capture = mock(async () => ({
      ipAddress: "203.0.113.5", location: "Prague, Czechia", locationSource: "manual" as const,
    }));

    await workItemService.createManual(PROJECT.id, USER_ID, START, END, "note", capture);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "manual",
    });
  });

  test("does not capture when the project is not the caller's", async () => {
    mockFindById.mockResolvedValue({ ...PROJECT, userId: "someone-else" });
    const capture = mock(async () => ({ ipAddress: "1.1.1.1", location: null, locationSource: "manual" as const }));

    expect(await workItemService.createManual(PROJECT.id, USER_ID, START, END, undefined, capture)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  test("does not capture when validation fails", async () => {
    mockFindById.mockResolvedValue(PROJECT);
    const capture = mock(async () => ({ ipAddress: "1.1.1.1", location: null, locationSource: "manual" as const }));

    await expect(workItemService.createManual(PROJECT.id, USER_ID, END, START, undefined, capture)).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `bun test src/services/work-item.service.test.ts`
Expected: "stores the capture" FAILS (capture not called, fields not passed). The other two pass.

- [ ] **Step 3: Implement.** In `packages/server/src/services/work-item.service.ts` add the import:

```ts
import { runCapture, type LocationCapture } from "../lib/location-capture";
```

Change the `createManual` signature to:

```ts
  async createManual(
    projectId: string,
    userId: string,
    startedAt: string,
    endedAt: string,
    description?: string,
    capture?: () => Promise<LocationCapture>
  ) {
```

Replace its `const item = await workItemRepository.create({ ... });` with:

```ts
    const captured = await runCapture(capture);
    const item = await workItemRepository.create({
      projectId,
      userId,
      startedAt: start,
      endedAt: end,
      description,
      ...captured,
    });
```

(The capture runs after the ownership, end-after-start and overlap checks, so rejected requests never trigger a lookup.)

- [ ] **Step 4: Wire the route.** In `packages/server/src/routes/work-items.ts` add:

```ts
import { captureLocation } from "../lib/location-capture";
```

and change the `createManual` call to:

```ts
    const item = await workItemService.createManual(
      c.req.param("id"),
      userId,
      startedAt,
      endedAt,
      description,
      () => captureLocation(c, "manual")
    );
```

- [ ] **Step 5: Run the full suite**

Run: `bun test`
Expected: all pass. If `trigger.service.test.ts` now fails, the cause is process-wide mock leakage. Make sure every `mock.module` factory for a repository lists all the methods above, then re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/server/src/services/work-item.service.ts packages/server/src/services/work-item.service.test.ts packages/server/src/routes/work-items.ts
git commit -m "feat(server): capture client IP and location on manual work entries"
```

---

### Task 7: Expose location to whitelisted org viewers only

**Files:**
- Modify: `packages/server/src/repositories/work-item.repository.ts:80-89` (`findByUserAndDateRange`)
- Modify: `packages/server/src/services/organisation.service.ts:242-261` (`getMemberWorkItems`)
- Modify: `packages/server/src/routes/organisations.ts:181-197`

**Interfaces:**
- Consumes: `SHOW_LOCATION` (Task 1), `isLocationWhitelisted` (Task 3)
- Produces: `workItemRepository.findByUserAndDateRange(userId, from, to, opts?: { includeLocation?: boolean })`, `organisationService.getMemberWorkItems(orgId, viewerId, memberId, from?, to?, opts?: { includeLocation?: boolean })`

The omit behaviour itself is proven by Task 1's integration test and the whitelist decision by Task 3's. This task is plumbing, verified in Task 9's manual check.

- [ ] **Step 1: Repository opt-in.** In `work-item.repository.ts` change the import to `import { prisma, SHOW_LOCATION } from "../db";` and replace `findByUserAndDateRange` with:

```ts
  async findByUserAndDateRange(
    userId: string,
    from: Date,
    to: Date,
    opts: { includeLocation?: boolean } = {}
  ) {
    return prisma.workItem.findMany({
      where: {
        userId,
        startedAt: { gte: from, lt: to },
      },
      include: { project: true },
      orderBy: { startedAt: "asc" },
      omit: opts.includeLocation ? SHOW_LOCATION : undefined,
    });
  },
```

(Its other caller, `timesheet.service.ts`, passes no `opts` and stays hidden.)

- [ ] **Step 2: Service pass-through.** In `organisation.service.ts` change `getMemberWorkItems` to:

```ts
  async getMemberWorkItems(
    orgId: string,
    viewerId: string,
    memberId: string,
    from?: string,
    to?: string,
    opts: { includeLocation?: boolean } = {}
  ) {
    if (!(await this.canViewMemberData(orgId, viewerId))) return null;
    const target = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      memberId
    );
    if (!target) return null;

    return workItemRepository.findByUserAndDateRange(
      memberId,
      from ? new Date(from) : new Date(0),
      to ? new Date(to) : new Date(),
      opts
    );
  },
```

- [ ] **Step 3: Route decision.** In `routes/organisations.ts` add `import { isLocationWhitelisted } from "../lib/whitelist";` and change the handler body of `"/:orgId/members/:memberId/work-items"` to:

```ts
  async (c) => {
    const userId = c.get("userId");
    const { from, to } = c.req.query();
    const includeLocation = isLocationWhitelisted(c.get("user")?.email);
    const items = await organisationService.getMemberWorkItems(
      c.req.param("orgId"),
      userId,
      c.req.param("memberId"),
      from,
      to,
      { includeLocation }
    );
    if (!items)
      return c.json({ error: "Not authorized or member not found" }, 403);
    return c.json(items);
  }
```

- [ ] **Step 4: Run the full suite**

Run: `bun test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/server/src/repositories/work-item.repository.ts packages/server/src/services/organisation.service.ts packages/server/src/routes/organisations.ts
git commit -m "feat(server): expose work item location to whitelisted org managers only"
```

---

### Task 8: Location badge in the org member view

**Files:**
- Create: `packages/web/src/components/location-badge.tsx`
- Modify: `packages/web/src/pages/org-member-view.tsx` (interface at line 63; table header around line 400; row cells around lines 411-438)

**Interfaces:**
- Consumes: API fields `ipAddress?: string | null`, `location?: string | null`, `locationSource?: string | null`, present only for whitelisted viewers (Task 7)
- Produces: `<LocationBadge ipAddress location locationSource />`

The web package has no test runner, so the gate is `bun run build` (tsc + vite) plus Task 9's manual check.

- [ ] **Step 1: Create** `packages/web/src/components/location-badge.tsx`:

```tsx
interface LocationBadgeProps {
  ipAddress?: string | null;
  location?: string | null;
  locationSource?: string | null;
}

export function LocationBadge({ ipAddress, location, locationSource }: LocationBadgeProps) {
  const label = location || ipAddress;
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={ipAddress ? `IP: ${ipAddress}` : undefined}
    >
      <span aria-hidden="true">📍</span>
      <span>{label}</span>
      {locationSource === "manual" && (
        <span className="rounded border px-1 text-[10px] uppercase tracking-wide">manual</span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Extend the type** in `org-member-view.tsx`:

```ts
interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
  project: { id: string; name: string; slug: string };
  ipAddress?: string | null;
  location?: string | null;
  locationSource?: string | null;
}
```

Add the import `import { LocationBadge } from "@/components/location-badge";`.

- [ ] **Step 3: Compute visibility.** Next to the `workItems` state (around line 132), add:

```ts
  // The fields are present (possibly null) only when the server allows this viewer to see them.
  const showLocation = useMemo(
    () => workItems.some((item) => "ipAddress" in item),
    [workItems]
  );
```

(`useMemo` is already imported.)

- [ ] **Step 4: Render the column.** After `<TableHead>Description</TableHead>`, add:

```tsx
                          {showLocation && <TableHead>Location</TableHead>}
```

After the description `<TableCell>` in the row, add:

```tsx
                            {showLocation && (
                              <TableCell>
                                <LocationBadge
                                  ipAddress={item.ipAddress}
                                  location={item.location}
                                  locationSource={item.locationSource}
                                />
                              </TableCell>
                            )}
```

- [ ] **Step 5: Build**

Run (in `packages/web`): `bun run build`
Expected: exits 0 with no TypeScript errors.

- [ ] **Step 6: Commit**

```bash
git add packages/web/src/components/location-badge.tsx packages/web/src/pages/org-member-view.tsx
git commit -m "feat(web): show work item location to whitelisted managers in member view"
```

---

### Task 9: Docs and end-to-end verification

**Files:**
- Modify: `README.md` (Environment Variables → Server table, lines 44-50)

- [ ] **Step 1: Document the variables.** Add these rows to the Server table in `README.md`, after `CORS_ORIGIN`:

```markdown
| `LOCATION_WHITELIST` | Comma-separated emails of org owners/managers who may see where members logged work (IP + city). Inform employees before enabling (GDPR). | empty (nobody) |
| `TRUST_PROXY` | `true` only behind your own reverse proxy that appends to `X-Forwarded-For`; otherwise the socket IP is used | unset |
```

- [ ] **Step 2: Full test suite**

Run (in `packages/server`): `bun test`
Expected: 0 fail.

- [ ] **Step 3: Manual end-to-end check.** Start the dev stack from the repo root with `LOCATION_WHITELIST=<manager email>` in `packages/server/.env`, then `bun run dev`. Check each item:
  - Start tracking from the web launcher. `bunx --bun prisma studio` (in `packages/server`) shows the new WorkItem with `ipAddress` set and `locationSource = trigger`. Locally the IP is `127.0.0.1`/`::1`, so `location` is `null`; that's expected (private IP)
  - `curl -s -b <session cookie> http://localhost:3000/api/status` → the JSON contains no `ipAddress`, `location` or `locationSource`
  - `curl -s -H "X-Forwarded-For: 8.8.8.8" http://localhost:3000/api/trigger/<token>/<slug>` → the stored `ipAddress` is still the loopback address, not `8.8.8.8`
  - Log in as the whitelisted manager and open Organisation → member → Work items: a Location column appears with 📍 badges
  - Remove the email from `LOCATION_WHITELIST` and restart: the Location column is gone and the API response has no location fields
  - Add a manual entry: its badge shows the `MANUAL` label

- [ ] **Step 4: Deployment note for the owner** (not automatable here): on the real Docker host, start tracking from an outside network and confirm the stored IP is the real public IP, not a `172.x` Docker gateway address. If it's the gateway, put a reverse proxy in front and set `TRUST_PROXY=true`.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document LOCATION_WHITELIST and TRUST_PROXY"
```
