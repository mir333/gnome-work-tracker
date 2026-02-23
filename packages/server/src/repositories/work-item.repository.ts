import { prisma } from "../db";

export const workItemRepository = {
  async findByProject(projectId: string, dateFrom?: Date, dateTo?: Date) {
    return prisma.workItem.findMany({
      where: {
        projectId,
        ...(dateFrom || dateTo
          ? {
              startedAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { startedAt: "desc" },
    });
  },

  async findActiveByUser(userId: string) {
    return prisma.workItem.findFirst({
      where: { userId, endedAt: null },
      include: { project: true },
    });
  },

  async findTodayByUser(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return prisma.workItem.findMany({
      where: {
        userId,
        startedAt: { gte: startOfDay },
      },
      include: { project: true },
      orderBy: { startedAt: "asc" },
    });
  },

  async findOverlapping(
    userId: string,
    startedAt: Date,
    endedAt: Date,
    excludeId?: string
  ) {
    return prisma.workItem.findFirst({
      where: {
        userId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { startedAt: { lt: endedAt }, endedAt: { gt: startedAt } },
          { startedAt: { lt: endedAt }, endedAt: null },
        ],
      },
    });
  },

  async create(data: {
    projectId: string;
    userId: string;
    startedAt: Date;
    endedAt?: Date;
    description?: string;
  }) {
    return prisma.workItem.create({ data });
  },

  async update(
    id: string,
    data: { endedAt?: Date; description?: string; startedAt?: Date }
  ) {
    return prisma.workItem.update({ where: { id }, data });
  },

  async findByUserAndDateRange(userId: string, from: Date, to: Date) {
    return prisma.workItem.findMany({
      where: {
        userId,
        startedAt: { gte: from, lt: to },
      },
      include: { project: true },
      orderBy: { startedAt: "asc" },
    });
  },

  async delete(id: string) {
    return prisma.workItem.delete({ where: { id } });
  },
};
