import { prisma } from "../db";

export const organisationInviteRepository = {
  async create(data: { orgId: string; email: string; invitedBy: string }) {
    return prisma.organisationInvite.create({
      data,
      include: {
        organisation: { select: { id: true, name: true } },
      },
    });
  },

  async findById(id: string) {
    return prisma.organisationInvite.findUnique({
      where: { id },
      include: {
        organisation: { select: { id: true, name: true } },
        inviter: { select: { id: true, name: true } },
      },
    });
  },

  async findByOrgAndEmail(orgId: string, email: string) {
    return prisma.organisationInvite.findUnique({
      where: { orgId_email: { orgId, email } },
    });
  },

  async findPendingByOrg(orgId: string) {
    return prisma.organisationInvite.findMany({
      where: { orgId, status: "pending" },
      include: {
        inviter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async findPendingByEmail(email: string) {
    return prisma.organisationInvite.findMany({
      where: { email, status: "pending" },
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
