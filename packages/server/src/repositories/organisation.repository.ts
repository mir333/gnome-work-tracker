import { prisma } from "../db";

export const organisationRepository = {
  async create(data: { name: string; ownerId: string }) {
    return prisma.organisation.create({ data });
  },

  async findById(id: string) {
    return prisma.organisation.findUnique({
      where: { id },
      include: {
        owner: {
          select: { id: true, name: true, email: true, username: true },
        },
      },
    });
  },

  async findByUser(userId: string) {
    return prisma.organisation.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async update(id: string, data: { name?: string }) {
    return prisma.organisation.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.organisation.delete({ where: { id } });
  },
};
