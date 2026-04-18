import { prisma } from "../db";

export const organisationMemberRepository = {
  async create(data: { orgId: string; userId: string; role: string }) {
    return prisma.organisationMember.create({ data });
  },

  async findByOrgAndUser(orgId: string, userId: string) {
    return prisma.organisationMember.findUnique({
      where: { orgId_userId: { orgId, userId } },
    });
  },

  async findAllByOrg(orgId: string) {
    return prisma.organisationMember.findMany({
      where: { orgId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            displayUsername: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });
  },

  async updateRole(orgId: string, userId: string, role: string) {
    return prisma.organisationMember.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role },
    });
  },

  async delete(orgId: string, userId: string) {
    return prisma.organisationMember.delete({
      where: { orgId_userId: { orgId, userId } },
    });
  },
};
