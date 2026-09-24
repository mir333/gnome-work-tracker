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
