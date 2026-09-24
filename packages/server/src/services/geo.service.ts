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
