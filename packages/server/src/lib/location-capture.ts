import type { Context } from "hono";
import { getClientIp } from "./client-ip";

export type LocationSource = "trigger" | "manual";

export type LocationCapture = {
  ipAddress: string | null;
  locationSource: LocationSource;
};

/** Records the client IP from the request as-is (no geo resolution). Never throws. */
export async function captureLocation(c: Context, source: LocationSource): Promise<LocationCapture> {
  return { ipAddress: getClientIp(c), locationSource: source };
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
