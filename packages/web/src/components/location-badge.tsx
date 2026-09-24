interface LocationBadgeProps {
  ipAddress?: string | null;
  location?: string | null;
  locationSource?: string | null;
}

export function LocationBadge({ ipAddress, location, locationSource }: LocationBadgeProps) {
  const label = location || ipAddress;
  if (!label) return <span className="text-muted-foreground">—</span>;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs text-muted-foreground"
      title={ipAddress ? `IP: ${ipAddress}` : undefined}
    >
      <span aria-hidden="true">📍</span>
      <span>{label}</span>
      {locationSource === "manual" && (
        <span className="rounded border px-1 text-[10px] uppercase tracking-wide">manual</span>
      )}
    </span>
  );
}
