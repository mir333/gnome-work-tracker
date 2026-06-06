import { workItemRepository } from "../repositories/work-item.repository";
import { projectRepository } from "../repositories/project.repository";
import {
  auditLogService,
  AuditAction,
  EntityType,
} from "./audit-log.service";

export const workItemService = {
  async listByProject(
    projectId: string,
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    return workItemRepository.findByProject(
      projectId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  },

  async getActive(userId: string) {
    return workItemRepository.findActiveByUser(userId);
  },

  async getToday(userId: string) {
    return workItemRepository.findTodayByUser(userId);
  },

  async getByDateRange(userId: string, from: string, to: string) {
    return workItemRepository.findByUserAndDateRange(
      userId,
      new Date(from),
      new Date(to)
    );
  },

  async createManual(
    projectId: string,
    userId: string,
    startedAt: string,
    endedAt: string,
    description?: string
  ) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    const start = new Date(startedAt);
    const end = new Date(endedAt);

    if (end <= start) throw new Error("End time must be after start time");

    const overlap = await workItemRepository.findOverlapping(userId, start, end);
    if (overlap) throw new Error("Work item overlaps with existing entry");

    const item = await workItemRepository.create({
      projectId,
      userId,
      startedAt: start,
      endedAt: end,
      description,
    });

    auditLogService.log(userId, AuditAction.WORK_ITEM_CREATED, EntityType.WORK_ITEM, item.id, {
      projectId,
      startedAt: start.toISOString(),
      endedAt: end.toISOString(),
      description: description ?? null,
    });

    return item;
  },

  async update(
    id: string,
    userId: string,
    data: { startedAt?: string; endedAt?: string; description?: string }
  ) {
    // Fetch existing state before the update for audit trail
    const before = await workItemRepository.findById(id);

    const result = await workItemRepository.update(id, {
      ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
      ...(data.endedAt ? { endedAt: new Date(data.endedAt) } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    });

    auditLogService.log(userId, AuditAction.WORK_ITEM_UPDATED, EntityType.WORK_ITEM, id, {
      before: before
        ? {
            startedAt: before.startedAt.toISOString(),
            endedAt: before.endedAt?.toISOString() ?? null,
            description: before.description ?? null,
          }
        : null,
      after: {
        startedAt: result.startedAt.toISOString(),
        endedAt: result.endedAt?.toISOString() ?? null,
        description: result.description ?? null,
      },
    });

    return result;
  },

  async delete(id: string, userId?: string) {
    // Fetch item before deletion so we can capture its state
    const item = await workItemRepository.findById(id);

    const result = await workItemRepository.delete(id);

    if (item) {
      auditLogService.log(
        userId ?? item.userId,
        AuditAction.WORK_ITEM_DELETED,
        EntityType.WORK_ITEM,
        id,
        {
          projectId: item.projectId,
          startedAt: item.startedAt.toISOString(),
          endedAt: item.endedAt?.toISOString() ?? null,
          description: item.description ?? null,
        }
      );
    }

    return result;
  },

  async appendDescription(userId: string, description: string) {
    const active = await workItemRepository.findActiveByUser(userId);
    if (!active) return null;

    const oldDescription = active.description ?? null;
    const newDescription = active.description
      ? active.description + "\n" + description
      : description;

    const result = await workItemRepository.update(active.id, { description: newDescription });

    auditLogService.log(userId, AuditAction.WORK_ITEM_UPDATED, EntityType.WORK_ITEM, active.id, {
      before: { description: oldDescription },
      after: { description: newDescription },
    });

    return result;
  },
};
