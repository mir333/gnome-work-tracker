# IP / Location on Work Items (Whitelisted Users Only)

**Date:** 2026-09-24  
**Status:** Approved for implementation

---

## Purpose

Employers need to verify that employees are logging work from expected locations (home, office). When a work tracking session starts or stops, the server silently captures the client IP address and resolves it to a human-readable city/country via ip-api.com. This data is stored on the work item and exposed in the API **only** to whitelisted users — everyone else sees no change.

---

## Success Criteria

- IP and location are stored on every work item created via any trigger endpoint
- Geocoding never causes a trigger to fail; failures result in `null` fields only
- Non-whitelisted users see zero difference in API responses or UI
- Whitelisted users see a 📍 location badge on work items in the dashboard and project detail views
- Each unique IP is geocoded at most once (DB cache)

---

## Data Layer

### Schema changes (`packages/server/prisma/schema.prisma`)

```prisma
model WorkItem {
  // existing fields unchanged
  ipAddress  String?
  location   String?   // e.g. "Prague, Czech Republic"
}

model IpLocationCache {
  ip        String   @id
  location  String   // e.g. "Prague, Czech Republic"
  cachedAt  DateTime @default(now())
}
```

- `WorkItem.ipAddress` — raw IP of the client at trigger time
- `WorkItem.location` — resolved human-readable location; null if geocoding failed
- `IpLocationCache` — permanent cache keyed by IP; each unique IP is geocoded once ever via ip-api.com and stored here for all future lookups

One Prisma migration required. No other schema changes.

---

## Server

### Geo Service (`packages/server/src/services/geo.service.ts`)

`resolveLocation(ip: string, db: PrismaClient): Promise<string | null>`

1. Look up `ip` in `IpLocationCache` → return `location` immediately if found
2. Call `http://ip-api.com/json/{ip}?fields=status,city,country`
3. On success (`status === "success"`): write entry to `IpLocationCache`, return `"City, Country"`
4. On any failure (network error, `status: "fail"`, private/loopback IP): return `null`

The function **never throws**. Any error is caught and results in `null`.

### IP Extraction

Client IP is read from Hono context at trigger time:

```
c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? c.env.remoteAddr
```

For `x-forwarded-for`, take the first (leftmost) entry.

### Trigger Endpoints (`packages/server/src/routes/trigger.ts`)

Only the **start** trigger endpoints capture IP and resolve location — stop endpoints do not overwrite it, since what matters for the work-from-home check is where work *began*:

- `GET /api/trigger/session/:slug` ✓ captures IP + location
- `GET /api/trigger/:apiToken/:slug` ✓ captures IP + location
- `GET /api/trigger/session/stop` — no capture
- `GET /api/trigger/:apiToken/stop` — no capture

The resolved `ipAddress` and `location` are passed into `trigger.service.ts` work item creation calls only.

### Trigger Service (`packages/server/src/services/trigger.service.ts`)

`startWork` accepts optional `ipAddress` and `location` parameters and writes them to the new `WorkItem` record. `stopWork` is unchanged.

### Whitelist Helper (`packages/server/src/lib/whitelist.ts`)

```
LOCATION_WHITELIST=email1@example.com,email2@example.com
```

`isLocationWhitelisted(email: string): boolean`

- Reads `process.env.LOCATION_WHITELIST` once at module load
- Splits by comma, trims whitespace
- Returns `true` if the email is in the list; `false` otherwise
- If env var is unset or empty, no one is whitelisted

### Response Sanitisation

`ipAddress` and `location` are stripped from work item objects in API responses when the requesting user is **not** whitelisted. The DB always stores the data; only serialisation differs.

Applied in:
- `GET /api/projects/:id/work-items` (`work-items.ts`)
- `GET /api/status` + `GET /api/status/:apiToken` (`status.ts`)
- `GET /api/trigger/...` responses (`trigger.ts`)
- `GET /api/organisations/:orgId/members/:memberId/work-items` (`organisations.ts`)

For session-authenticated endpoints, the caller's email is available via the session user. For token-authenticated endpoints, the token is looked up to retrieve the user and their email.

---

## Web UI (`packages/web`)

### Type Extension

```typescript
interface WorkItemWithProject {
  // existing fields ...
  ipAddress?: string
  location?: string
}
```

Fields are absent (not null) for non-whitelisted users — no permission check needed in the frontend. Presence of either field implies the user is whitelisted.

### Location Badge Component

A small inline badge rendered in work item rows:

- Shows `📍 Prague, Czech Republic` when `location` is set
- Falls back to `📍 <ipAddress>` when only `ipAddress` is available
- Renders nothing when both fields are absent

### Display Locations

Badge added to work item rows in:
- `packages/web/src/pages/project-detail.tsx` — work items list
- `packages/web/src/pages/dashboard.tsx` — day/week timeline entries

No new pages, routes, or settings UI.

---

## Branch

All work is done on a new branch: `feature/ip-location-work-items`

---

## Out of Scope

- UI for managing the whitelist (env var only)
- GPS / browser geolocation
- Alerting or notifications when unexpected locations are detected
- Cache expiry / TTL on `IpLocationCache` (home IPs are stable; manual DB clear if needed)
- Displaying location in the GNOME extension
