import { prisma } from "../db";

export const userProfileRepository = {
  async findByUserId(userId: string) {
    return prisma.userProfile.findUnique({ where: { userId } });
  },

  async findByApiToken(apiToken: string) {
    return prisma.userProfile.findUnique({
      where: { apiToken },
      include: { user: true },
    });
  },

  async create(userId: string) {
    return prisma.userProfile.create({ data: { userId } });
  },

  async regenerateToken(userId: string) {
    return prisma.userProfile.update({
      where: { userId },
      data: { apiToken: crypto.randomUUID() },
    });
  },
};
