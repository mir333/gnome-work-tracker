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
