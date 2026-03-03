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
      const now = new Date();
      const durationSecs =
        (now.getTime() - new Date(active.startedAt).getTime()) / 1000;

      if (durationSecs < 30) {
        // Auto-delete entries shorter than 30 seconds
        await workItemRepository.delete(active.id);
      } else {
        await workItemRepository.update(active.id, { endedAt: now });
      }
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
      const now = new Date();
      const durationSecs =
        (now.getTime() - new Date(active.startedAt).getTime()) / 1000;

      if (durationSecs < 30) {
        // Auto-delete entries shorter than 30 seconds
        await workItemRepository.delete(active.id);
      } else {
        await workItemRepository.update(active.id, { endedAt: now });
      }
    }
    return true;
  },
};
