import { describe, test, expect, afterEach } from "bun:test";
import { isLocationTrackingEnabled, locationCaptureFor } from "./location-capture";
import type { Context } from "hono";

const ORIGINAL_LOCATION_TRACKING = process.env.LOCATION_TRACKING;

afterEach(() => {
  if (ORIGINAL_LOCATION_TRACKING === undefined) {
    delete process.env.LOCATION_TRACKING;
  } else {
    process.env.LOCATION_TRACKING = ORIGINAL_LOCATION_TRACKING;
  }
});

const fakeContext = {} as Context;

describe("isLocationTrackingEnabled / locationCaptureFor", () => {
  test("disabled when LOCATION_TRACKING is unset", () => {
    delete process.env.LOCATION_TRACKING;
    expect(isLocationTrackingEnabled()).toBe(false);
    expect(locationCaptureFor(fakeContext, "trigger")).toBeUndefined();
  });

  test("disabled when LOCATION_TRACKING is \"false\"", () => {
    process.env.LOCATION_TRACKING = "false";
    expect(isLocationTrackingEnabled()).toBe(false);
    expect(locationCaptureFor(fakeContext, "trigger")).toBeUndefined();
  });

  test("disabled when LOCATION_TRACKING is \"1\" (only the literal string \"true\" enables it)", () => {
    process.env.LOCATION_TRACKING = "1";
    expect(isLocationTrackingEnabled()).toBe(false);
    expect(locationCaptureFor(fakeContext, "manual")).toBeUndefined();
  });

  test("enabled when LOCATION_TRACKING is \"true\"", () => {
    process.env.LOCATION_TRACKING = "true";
    expect(isLocationTrackingEnabled()).toBe(true);
    expect(typeof locationCaptureFor(fakeContext, "trigger")).toBe("function");
  });
});
