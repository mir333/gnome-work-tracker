import { prisma } from "../db";

export const timesheetEntryRepository = {
  async findByUserAndDateRange(
    userId: string,
    fromDate: string,
    toDate: string
  ) {
    return prisma.timesheetEntry.findMany({
      where: {
        userId,
        date: { gte: fromDate, lte: toDate },
      },
      include: { project: true },
    });
  },

  async findByUserProjectAndDate(
    userId: string,
    projectId: string,
    date: string
  ) {
    return prisma.timesheetEntry.findUnique({
      where: { userId_projectId_date: { userId, projectId, date } },
    });
  },

  async upsert(data: {
    userId: string;
    projectId: string;
    date: string;
    adjustedMinutes: number;
    description?: string | null;
  }) {
    return prisma.timesheetEntry.upsert({
      where: {
        userId_projectId_date: {
          userId: data.userId,
          projectId: data.projectId,
          date: data.date,
        },
      },
      create: data,
      update: {
        adjustedMinutes: data.adjustedMinutes,
        description: data.description,
      },
    });
  },

  async findById(id: string) {
    return prisma.timesheetEntry.findUnique({ where: { id } });
  },

  async delete(id: string) {
    return prisma.timesheetEntry.delete({ where: { id } });
  },
};
