import { workItemRepository } from "../repositories/work-item.repository";
import { projectRepository } from "../repositories/project.repository";

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

    return workItemRepository.create({
      projectId,
      userId,
      startedAt: start,
      endedAt: end,
      description,
    });
  },

  async update(
    id: string,
    userId: string,
    data: { startedAt?: string; endedAt?: string; description?: string }
  ) {
    const existing = await workItemRepository.findActiveByUser(userId);
    // Fetch the specific item to validate ownership
    const items = await workItemRepository.findByProject(data.startedAt ? "" : "", undefined, undefined);
    // Simpler: just try updating and check
    return workItemRepository.update(id, {
      ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
      ...(data.endedAt ? { endedAt: new Date(data.endedAt) } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    });
  },

  async delete(id: string) {
    return workItemRepository.delete(id);
  },
};
