import { userProfileRepository } from "../repositories/user-profile.repository";
import { projectRepository } from "../repositories/project.repository";
import { workItemRepository } from "../repositories/work-item.repository";
import {
  auditLogService,
  AuditAction,
  EntityType,
} from "./audit-log.service";

export const triggerService = {
  async resolveToken(apiToken: string) {
    return userProfileRepository.findByApiToken(apiToken);
  },

  async startWork(userId: string, slug: string) {
    const project = await projectRepository.findBySlug(slug);
    if (!project || project.userId !== userId) return null;

    // If already working on this project, return existing work item (idempotent)
    const active = await workItemRepository.findActiveByUser(userId);
    if (active && active.projectId === project.id) {
      return active;
    }

    // Close any active work item (different project)
    if (active) {
      const now = new Date();
      const durationSecs =
        (now.getTime() - new Date(active.startedAt).getTime()) / 1000;

      if (durationSecs < 30) {
        // Auto-delete entries shorter than 30 seconds
        await workItemRepository.delete(active.id);
        auditLogService.log(userId, AuditAction.WORK_ITEM_AUTO_DELETED, EntityType.WORK_ITEM, active.id, {
          projectId: active.projectId,
          startedAt: active.startedAt.toISOString(),
          durationSecs: Math.round(durationSecs),
          reason: "Duration less than 30 seconds on project switch",
        });
      } else {
        await workItemRepository.update(active.id, { endedAt: now });
        auditLogService.log(userId, AuditAction.WORK_ITEM_STOPPED, EntityType.WORK_ITEM, active.id, {
          projectId: active.projectId,
          startedAt: active.startedAt.toISOString(),
          endedAt: now.toISOString(),
          reason: "Switched to different project",
        });
      }
    }

    // Start new work item
    const newItem = await workItemRepository.create({
      projectId: project.id,
      userId,
      startedAt: new Date(),
    });

    auditLogService.log(userId, AuditAction.WORK_ITEM_STARTED, EntityType.WORK_ITEM, newItem.id, {
      projectId: project.id,
      projectSlug: slug,
      startedAt: newItem.startedAt.toISOString(),
    });

    return newItem;
  },

  async stopAll(userId: string) {
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
      const now = new Date();
      const durationSecs =
        (now.getTime() - new Date(active.startedAt).getTime()) / 1000;

      if (durationSecs < 30) {
        // Auto-delete entries shorter than 30 seconds
        await workItemRepository.delete(active.id);
        auditLogService.log(userId, AuditAction.WORK_ITEM_AUTO_DELETED, EntityType.WORK_ITEM, active.id, {
          projectId: active.projectId,
          startedAt: active.startedAt.toISOString(),
          durationSecs: Math.round(durationSecs),
          reason: "Duration less than 30 seconds on stop",
        });
      } else {
        await workItemRepository.update(active.id, { endedAt: now });
        auditLogService.log(userId, AuditAction.WORK_ITEM_STOPPED, EntityType.WORK_ITEM, active.id, {
          projectId: active.projectId,
          startedAt: active.startedAt.toISOString(),
          endedAt: now.toISOString(),
        });
      }
    }
    return true;
  },

  async updateWorkItem(
    userId: string,
    workItemId: string,
    data: { startedAt?: string }
  ) {
    const workItem = await workItemRepository.findById(workItemId);
    if (!workItem || workItem.userId !== userId) return null;

    const before = {
      startedAt: workItem.startedAt.toISOString(),
    };

    const result = await workItemRepository.update(workItemId, {
      ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
    });

    auditLogService.log(userId, AuditAction.WORK_ITEM_UPDATED, EntityType.WORK_ITEM, workItemId, {
      before,
      after: {
        startedAt: result.startedAt.toISOString(),
      },
    });

    return result;
  },
};
