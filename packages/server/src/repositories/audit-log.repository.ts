import { prisma } from "../db";

export const auditLogRepository = {
  async create(data: {
    userId: string;
    action: string;
    entityType: string;
    entityId: string;
    payload?: string | null;
  }) {
    return prisma.auditLog.create({ data });
  },
};
