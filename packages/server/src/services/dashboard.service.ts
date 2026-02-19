import { dashboardRepository } from "../repositories/dashboard.repository";
import { projectRepository } from "../repositories/project.repository";

export const dashboardService = {
  async getSlots(userId: string) {
    return dashboardRepository.findByUser(userId);
  },

  async updateSlots(
    userId: string,
    slots: { slot: number; projectId: string | null }[]
  ) {
    for (const { slot, projectId } of slots) {
      if (slot < 1 || slot > 6) throw new Error("Slot must be 1-6");

      if (projectId) {
        const project = await projectRepository.findById(projectId);
        if (!project || project.userId !== userId) {
          throw new Error(`Invalid project for slot ${slot}`);
        }
        await dashboardRepository.upsertSlot(userId, slot, projectId);
      } else {
        await dashboardRepository.deleteSlot(userId, slot);
      }
    }

    return dashboardRepository.findByUser(userId);
  },
};
