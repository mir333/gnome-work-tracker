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

/** Collection is opt-in: nothing is captured unless this is explicitly enabled. */
export function isLocationTrackingEnabled(): boolean {
  return process.env.LOCATION_TRACKING === "true";
}

/** Returns a lazy capture thunk when tracking is enabled, otherwise undefined. */
export function locationCaptureFor(
  c: Context,
  source: LocationSource
): (() => Promise<LocationCapture>) | undefined {
  if (!isLocationTrackingEnabled()) return undefined;
  return () => captureLocation(c, source);
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
