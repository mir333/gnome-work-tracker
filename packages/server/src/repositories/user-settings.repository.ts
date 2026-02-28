import { prisma } from "../db";

export const userSettingsRepository = {
  async findByUserId(userId: string) {
    return prisma.userSettings.findUnique({ where: { userId } });
  },

  async upsert(userId: string, data: { hoursPerManDay?: number }) {
    return prisma.userSettings.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  },
};
