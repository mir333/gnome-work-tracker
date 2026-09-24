import { prisma, SHOW_LOCATION } from "../db";

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

  async findById(id: string) {
    return prisma.workItem.findUnique({ where: { id } });
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
    ipAddress?: string | null;
    location?: string | null;
    locationSource?: string | null;
  }) {
    return prisma.workItem.create({ data });
  },

  async update(
    id: string,
    data: { endedAt?: Date; description?: string; startedAt?: Date }
  ) {
    return prisma.workItem.update({ where: { id }, data });
  },

  async findByUserAndDateRange(
    userId: string,
    from: Date,
    to: Date,
    opts: { includeLocation?: boolean } = {}
  ) {
    return prisma.workItem.findMany({
      where: {
        userId,
        startedAt: { gte: from, lt: to },
      },
      include: { project: true },
      orderBy: { startedAt: "asc" },
      omit: opts.includeLocation ? SHOW_LOCATION : undefined,
    });
  },

  async delete(id: string) {
    return prisma.workItem.delete({ where: { id } });
  },
};
