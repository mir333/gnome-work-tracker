import { prisma } from "../db";

export const dashboardRepository = {
  async findByUser(userId: string) {
    return prisma.dashboardConfig.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { slot: "asc" },
    });
  },

  async upsertSlot(userId: string, slot: number, projectId: string) {
    return prisma.dashboardConfig.upsert({
      where: { userId_slot: { userId, slot } },
      update: { projectId },
      create: { userId, slot, projectId },
    });
  },

  async deleteSlot(userId: string, slot: number) {
    return prisma.dashboardConfig.deleteMany({
      where: { userId, slot },
    });
  },

  async clearAll(userId: string) {
    return prisma.dashboardConfig.deleteMany({ where: { userId } });
  },
};
