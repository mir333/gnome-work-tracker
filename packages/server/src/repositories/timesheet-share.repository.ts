import { prisma } from "../db";

export const timesheetShareRepository = {
  async findByToken(token: string) {
    return prisma.timesheetShare.findUnique({
      where: { token },
      include: { project: true },
    });
  },

  async findByProjectAndMonth(projectId: string, month: string) {
    return prisma.timesheetShare.findUnique({
      where: { projectId_month: { projectId, month } },
    });
  },

  async findAllByProject(projectId: string) {
    return prisma.timesheetShare.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: { projectId: string; userId: string; month: string }) {
    return prisma.timesheetShare.create({ data });
  },

  async delete(id: string) {
    return prisma.timesheetShare.delete({ where: { id } });
  },
};
