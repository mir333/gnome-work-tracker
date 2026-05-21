import { organisationRepository } from "../repositories/organisation.repository";
import { organisationMemberRepository } from "../repositories/organisation-member.repository";
import { organisationInviteRepository } from "../repositories/organisation-invite.repository";
import { workItemRepository } from "../repositories/work-item.repository";
import { projectRepository } from "../repositories/project.repository";
import { timesheetService } from "./timesheet.service";
import { prisma } from "../db";

export const organisationService = {
  // ---- Organisation CRUD ----

  async create(userId: string, name: string) {
    const org = await organisationRepository.create({ name, ownerId: userId });
    await organisationMemberRepository.create({
      orgId: org.id,
      userId,
      role: "owner",
    });
    return org;
  },

  async getById(orgId: string, userId: string) {
    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      userId
    );
    if (!membership) return null;
    return organisationRepository.findById(orgId);
  },

  async listByUser(userId: string) {
    return organisationRepository.findByUser(userId);
  },

  async update(orgId: string, userId: string, data: { name?: string }) {
    const org = await organisationRepository.findById(orgId);
    if (!org || org.ownerId !== userId) return null;
    return organisationRepository.update(orgId, data);
  },

  async delete(orgId: string, userId: string) {
    const org = await organisationRepository.findById(orgId);
    if (!org || org.ownerId !== userId) return false;
    await organisationRepository.delete(orgId);
    return true;
  },

  // ---- Invite management ----

  async sendInvite(orgId: string, inviterId: string, username: string) {
    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      inviterId
    );
    if (!membership || membership.role === "member") {
      return { error: "Not authorized" };
    }

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: username },
          { displayUsername: username },
        ],
      },
    });
    if (!targetUser) return { error: "User not found" };

    if (targetUser.id === inviterId) return { error: "Cannot invite yourself" };

    const existingMember =
      await organisationMemberRepository.findByOrgAndUser(
        orgId,
        targetUser.id
      );
    if (existingMember) return { error: "User is already a member" };

    const existingInvite = await organisationInviteRepository.findByOrgAndUser(
      orgId,
      targetUser.id
    );
    if (existingInvite && existingInvite.status === "pending") {
      return { error: "Invite already pending" };
    }

    if (existingInvite) {
      await organisationInviteRepository.delete(existingInvite.id);
    }

    const invite = await organisationInviteRepository.create({
      orgId,
      targetUserId: targetUser.id,
      invitedBy: inviterId,
    });
    return { invite };
  },

  async getPendingInvitesForOrg(orgId: string, userId: string) {
    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      userId
    );
    if (!membership || membership.role === "member") return null;
    return organisationInviteRepository.findPendingByOrg(orgId);
  },

  async getMyPendingInvites(userId: string) {
    return organisationInviteRepository.findPendingByUserId(userId);
  },

  async acceptInvite(inviteId: string, userId: string) {
    const invite = await organisationInviteRepository.findById(inviteId);
    if (!invite || invite.status !== "pending") return null;
    if (invite.targetUserId !== userId) return null;

    await organisationMemberRepository.create({
      orgId: invite.orgId,
      userId,
      role: "member",
    });

    await organisationInviteRepository.updateStatus(inviteId, "accepted");
    return invite.organisation;
  },

  async declineInvite(inviteId: string, userId: string) {
    const invite = await organisationInviteRepository.findById(inviteId);
    if (!invite || invite.status !== "pending") return null;
    if (invite.targetUserId !== userId) return null;

    await organisationInviteRepository.updateStatus(inviteId, "declined");
    return true;
  },

  async cancelInvite(inviteId: string, userId: string) {
    const invite = await organisationInviteRepository.findById(inviteId);
    if (!invite) return false;

    const membership = await organisationMemberRepository.findByOrgAndUser(
      invite.orgId,
      userId
    );
    if (!membership || membership.role === "member") return false;

    await organisationInviteRepository.delete(inviteId);
    return true;
  },

  // ---- Member management ----

  async listMembers(orgId: string, userId: string) {
    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      userId
    );
    if (!membership) return null;
    return organisationMemberRepository.findAllByOrg(orgId);
  },

  async changeRole(
    orgId: string,
    requesterId: string,
    targetUserId: string,
    newRole: string
  ) {
    const org = await organisationRepository.findById(orgId);
    if (!org || org.ownerId !== requesterId) {
      return { error: "Only owner can change roles" };
    }

    if (targetUserId === requesterId)
      return { error: "Cannot change own role" };
    if (newRole === "owner") return { error: "Cannot assign owner role" };
    if (newRole !== "manager" && newRole !== "member")
      return { error: "Invalid role" };

    const target = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      targetUserId
    );
    if (!target) return { error: "User is not a member" };

    await organisationMemberRepository.updateRole(orgId, targetUserId, newRole);
    return { ok: true };
  },

  async removeMember(
    orgId: string,
    requesterId: string,
    targetUserId: string
  ) {
    const org = await organisationRepository.findById(orgId);
    if (!org) return { error: "Organisation not found" };

    if (targetUserId === org.ownerId)
      return { error: "Cannot remove the owner" };

    const requesterMembership =
      await organisationMemberRepository.findByOrgAndUser(orgId, requesterId);
    if (!requesterMembership) return { error: "Not a member" };

    if (requesterId !== targetUserId) {
      // Removing someone else: must be owner or manager
      if (requesterMembership.role === "member")
        return { error: "Not authorized" };
    }

    await organisationMemberRepository.delete(orgId, targetUserId);
    return { ok: true };
  },

  // ---- Visibility / Reports ----

  async getUserRole(orgId: string, userId: string) {
    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      userId
    );
    return membership?.role ?? null;
  },

  async canViewMemberData(orgId: string, viewerId: string) {
    const role = await this.getUserRole(orgId, viewerId);
    return role === "owner" || role === "manager";
  },

  async getMemberProjects(
    orgId: string,
    viewerId: string,
    memberId: string
  ) {
    if (!(await this.canViewMemberData(orgId, viewerId))) return null;
    const target = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      memberId
    );
    if (!target) return null;

    return projectRepository.findAllByUser(memberId);
  },

  async getMemberWorkItems(
    orgId: string,
    viewerId: string,
    memberId: string,
    from?: string,
    to?: string
  ) {
    if (!(await this.canViewMemberData(orgId, viewerId))) return null;
    const target = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      memberId
    );
    if (!target) return null;

    return workItemRepository.findByUserAndDateRange(
      memberId,
      from ? new Date(from) : new Date(0),
      to ? new Date(to) : new Date()
    );
  },

  async getOrgReport(
    orgId: string,
    viewerId: string,
    from: string,
    to: string
  ) {
    if (!(await this.canViewMemberData(orgId, viewerId))) return null;

    const members = await organisationMemberRepository.findAllByOrg(orgId);

    const memberData = await Promise.all(
      members.map(async (member) => {
        const ts = await timesheetService.getTimesheet(
          member.userId,
          from,
          to
        );
        return {
          userId: member.userId,
          userName: member.user.name,
          role: member.role,
          totalEffectiveMinutes: ts.totalEffectiveMinutes,
          manDays: ts.manDays,
        };
      })
    );

    return memberData;
  },
};
