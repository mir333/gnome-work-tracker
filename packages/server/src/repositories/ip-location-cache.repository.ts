import { prisma } from "../db";

export const ipLocationCacheRepository = {
  async get(ip: string) {
    return prisma.ipLocationCache.findUnique({
      where: { ip },
      select: { location: true, cachedAt: true },
    });
  },

  async save(ip: string, location: string) {
    await prisma.ipLocationCache.upsert({
      where: { ip },
      create: { ip, location },
      update: { location, cachedAt: new Date() },
    });
  },
};
