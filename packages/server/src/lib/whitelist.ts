/** Emails allowed to see work item IP/location. Read on every call so config changes and tests take effect. */
export function isLocationWhitelisted(email: string | null | undefined): boolean {
  const target = email?.trim().toLowerCase();
  if (!target) return false;
  const list = (process.env.LOCATION_WHITELIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(target);
}
