import { PrismaClient } from "@prisma/client";

/** Location columns are hidden from every WorkItem query unless a query opts in. */
export const HIDE_LOCATION = {
  ipAddress: true,
  location: true,
  locationSource: true,
} as const;

/** Pass as `omit` on a single query to include the location columns. */
export const SHOW_LOCATION = {
  ipAddress: false,
  location: false,
  locationSource: false,
} as const;

export function createPrismaClient(datasourceUrl?: string) {
  return new PrismaClient({
    omit: { workItem: HIDE_LOCATION },
    ...(datasourceUrl ? { datasourceUrl } : {}),
  });
}

export const prisma = createPrismaClient();
