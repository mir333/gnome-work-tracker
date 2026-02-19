import { prisma } from "../db";

export const projectRepository = {
  async findAllByUser(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  async findBySlug(slug: string) {
    return prisma.project.findUnique({ where: { slug } });
  },

  async create(data: { name: string; slug: string; userId: string }) {
    return prisma.project.create({ data });
  },

  async update(id: string, data: { name?: string; slug?: string }) {
    return prisma.project.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.project.delete({ where: { id } });
  },
};
