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
