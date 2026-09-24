# IP / Location on Work Items (Whitelisted Viewers Only)

**Date:** 2026-09-24
**Status:** Approved for implementation (revised after design review)
**Branch:** `feature/ip-location-work-items`

---

## Purpose

A work-from-home safeguard. Employers need to check that employees log work from expected locations (home, office). When a work item is created, the server records the client IP address and resolves it to a city/country. Owners/managers whose email is on a server-side whitelist can see this data on their organisation members' work items. Nobody else sees it anywhere.

---

## Success Criteria

- Every work item created via a start trigger or a manual entry stores the client IP, a resolved location (when resolvable), and how it was created (`trigger` / `manual`)
- Clients cannot fake the IP when the server is directly exposed (no client-supplied headers trusted by default)
- Geocoding never makes a create request fail and never blocks it for more than 2 seconds
- `ipAddress`, `location` and `locationSource` never appear in any API response except the org member work-items endpoint, and only when the caller is whitelisted
- Whitelisted owners/managers see a 📍 location badge per work item in the org member view
- Each public IP is geocoded at most once per 30 days (DB cache)

---

## Data Layer

### Schema changes (`packages/server/prisma/schema.prisma`)

```prisma
model WorkItem {
  // existing fields unchanged
  ipAddress      String?
  location       String?   // e.g. "Prague, Czechia"
  locationSource String?   // "trigger" | "manual"; null for items created before this feature
}

model IpLocationCache {
  ip        String   @id
  location  String
  cachedAt  DateTime @default(now())
}
```

- One Prisma migration. Existing rows keep `null` in all three fields.
- `WorkItem.location` is copied at creation time, so later cache changes don't rewrite history.
- The existing update paths (`workItemService.update`, `triggerService.updateWorkItem`) copy only allowed fields into Prisma. They must stay that way so users can't overwrite their own location.

### Hidden by default

The Prisma client in `src/db.ts` uses Prisma's global `omit` to hide `ipAddress`, `location` and `locationSource` on `WorkItem` for **every** query. Because of that, the status, trigger, project, timesheet, shared-timesheet and dashboard responses can't leak the fields, even through routes added later. Exactly one query opts back in (see Exposure).

---

## Server

### Client IP (`src/lib/client-ip.ts`)

`getClientIp(c: Context): string | null`

- Default: the TCP peer address from `getConnInfo(c)` (`hono/bun`). The request headers are ignored.
- If `TRUST_PROXY=true`: use the **last** entry of `X-Forwarded-For` (the one our own reverse proxy appended). Fall back to the peer address.
- Never take the leftmost `X-Forwarded-For` entry, because the client controls it.

The current `docker-compose.yml` exposes the server directly, so `TRUST_PROXY` stays unset there. Deployment check: with Docker port mapping the peer address must be the real client, not the `172.x` bridge gateway. Verify this on the real deployment (see Testing).

### Private IP check (`src/lib/client-ip.ts`)

`isPrivateIp(ip: string): boolean`: true for loopback, RFC1918, link-local, CGNAT (100.64/10), IPv6 ULA/link-local/loopback, and IPv4-mapped forms of these (`::ffff:10.0.0.1`). Private IPs are stored but not geocoded.

### Geo Service (`src/services/geo.service.ts`)

`resolveLocation(ip: string | null): Promise<string | null>`

1. `null` IP or private IP → return `null`
2. Look up `IpLocationCache`; if the entry exists and `cachedAt` is younger than 30 days → return it
3. Call `http://ip-api.com/json/{ip}?fields=status,city,country` with a **2 second timeout** (`AbortSignal.timeout(2000)`)
4. `status === "success"` → upsert the cache entry and return `"City, Country"`
5. Anything else (timeout, network error, `status: "fail"`, bad JSON) → return `null`

Never throws. The HTTP call goes through an injectable `fetch` so tests can mock it.

**Provider notes:** the ip-api.com free endpoint is HTTP only and licensed for non-commercial use. The owner has chosen it. All provider-specific code stays inside `geo.service.ts`, so switching to the paid endpoint or MaxMind GeoLite2 only touches that file.

### Capture points

| Endpoint | Captures | `locationSource` |
|---|---|---|
| `GET /api/trigger/session/:slug` | yes | `trigger` |
| `GET /api/trigger/:apiToken/:slug` | yes | `trigger` |
| `POST /api/projects/:id/work-items` (manual entry) | yes | `manual` |
| stop triggers, updates, description appends | no | — |

Capture only happens when a **new** item is created. The idempotent "already on this project" branch of `startWork` returns the existing item unchanged. Routes compute `ip = getClientIp(c)` and `location = await resolveLocation(ip)`, then pass `{ ipAddress, location, locationSource }` into `triggerService.startWork(...)` / `workItemService.createManual(...)` as an optional `capture` argument.

For the session trigger and manual entries, the IP is wherever the user's browser is. For token triggers, it's the machine running the GNOME extension.

### Whitelist (`src/lib/whitelist.ts`)

```
LOCATION_WHITELIST=boss@example.com,hr@example.com
```

`isLocationWhitelisted(email: string | null | undefined): boolean`: comma-split, trimmed, case-insensitive match. Unset or empty means nobody is whitelisted. The value is read on every call (cheap), so tests can set the env var.

### Exposure (the only opt-in)

`GET /api/organisations/:orgId/members/:memberId/work-items` (already restricted to org `owner`/`manager`):

- If `isLocationWhitelisted(c.get("user").email)`: `organisationService.getMemberWorkItems(..., { includeLocation: true })` → the repository query passes `omit: { ipAddress: false, location: false, locationSource: false }`
- Otherwise the response is unchanged.

The whitelist adds to the org role and doesn't replace it. A whitelisted user only sees locations for members of orgs they own or manage.

---

## Web UI (`packages/web`)

Only `src/pages/org-member-view.tsx` changes:

- `WorkItemWithProject` gets optional `ipAddress?`, `location?`, `locationSource?`
- New component `src/components/location-badge.tsx`:
  - `📍 Prague, Czechia` when `location` is set; otherwise `📍 <ipAddress>`; `—` when both are empty (e.g. items created before this feature)
  - Appends a muted `manual` label when `locationSource === "manual"`
  - Tooltip (`title`) shows the raw IP
- A "Location" column is added to the work items table **only when the response contains the `ipAddress` key** (the key is present, possibly `null`, only for whitelisted viewers), so non-whitelisted viewers see the exact same table as before.

Dashboard, project detail, launcher and the GNOME extension are unchanged.

---

## Testing

- Add `"test": "bun test"` to `packages/server/package.json` (one `bun:test` file already exists: `src/services/trigger.service.test.ts`; there's just no script)
- Unit tests: `isPrivateIp`, `getClientIp` (peer by default, spoofed `X-Forwarded-For` ignored, last entry used with `TRUST_PROXY=true`), `isLocationWhitelisted`, and `resolveLocation` (private IP skip, cache hit, stale cache refetch, success, `fail`, timeout/throw), using a mocked fetch and a mocked cache repository
- Manual verification: start tracking from the web and from the extension, confirm the stored IP is the real client IP (not `127.0.0.1` / `172.x`), confirm the org member view shows the badge for a whitelisted manager and no column for a non-whitelisted one, and confirm `/api/status` never contains `ipAddress`

---

## Compliance (deployment requirement, not code)

This records personal data about employees and sends their IP addresses to a third party (ip-api.com). Under GDPR, employees must be told about the monitoring and its purpose before it's enabled. Enabling it silently isn't acceptable.

---

## Out of Scope

- UI for managing the whitelist (env var only)
- GPS / browser geolocation
- Alerts on unexpected locations
- Location in the dashboard, project detail, launcher or GNOME extension
- Backfilling location for existing work items

## Known pre-existing issue (separate fix)

`PUT /api/work-items/:id` and `DELETE /api/work-items/:id` don't check that the item belongs to the caller (`workItemService.update` / `delete`). Any logged-in user can edit or delete any work item by ID. This isn't caused by this feature, but it weakens trust in the data this feature relies on. Fix it separately.
