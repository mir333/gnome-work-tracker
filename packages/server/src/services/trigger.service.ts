import { userProfileRepository } from "../repositories/user-profile.repository";
import { projectRepository } from "../repositories/project.repository";
import { workItemRepository } from "../repositories/work-item.repository";

export const triggerService = {
  async resolveToken(apiToken: string) {
    return userProfileRepository.findByApiToken(apiToken);
  },

  async startWork(userId: string, slug: string) {
    const project = await projectRepository.findBySlug(slug);
    if (!project || project.userId !== userId) return null;

    // Close any active work item
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
      await workItemRepository.update(active.id, { endedAt: new Date() });
    }

    // Start new work item
    return workItemRepository.create({
      projectId: project.id,
      userId,
      startedAt: new Date(),
    });
  },

  async stopAll(userId: string) {
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
      await workItemRepository.update(active.id, { endedAt: new Date() });
    }
    return true;
  },
};
