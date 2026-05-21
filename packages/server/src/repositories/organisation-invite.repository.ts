import { prisma } from "../db";

export const organisationInviteRepository = {
  async create(data: { orgId: string; targetUserId: string; invitedBy: string }) {
    return prisma.organisationInvite.create({
      data,
      include: {
        organisation: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true, username: true, displayUsername: true } },
      },
    });
  },

  async findById(id: string) {
    return prisma.organisationInvite.findUnique({
      where: { id },
      include: {
        organisation: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true, username: true, displayUsername: true } },
      },
    });
  },

  async findByOrgAndUser(orgId: string, targetUserId: string) {
    return prisma.organisationInvite.findUnique({
      where: { orgId_targetUserId: { orgId, targetUserId } },
    });
  },

  async findPendingByOrg(orgId: string) {
    return prisma.organisationInvite.findMany({
      where: { orgId, status: "pending" },
      include: {
        inviter: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true, username: true, displayUsername: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findPendingByUserId(userId: string) {
    return prisma.organisationInvite.findMany({
      where: { targetUserId: userId, status: "pending" },
      include: {
        organisation: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async updateStatus(id: string, status: string) {
    return prisma.organisationInvite.update({
      where: { id },
      data: { status },
    });
  },

  async delete(id: string) {
    return prisma.organisationInvite.delete({ where: { id } });
  },
};
