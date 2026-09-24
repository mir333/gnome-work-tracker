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
