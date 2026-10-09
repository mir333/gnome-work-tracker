import { dashboardRepository } from "../repositories/dashboard.repository";
import { projectRepository } from "../repositories/project.repository";

type SlotWithProject = {
  slot: number;
  project: { slug: string; name: string; shortName: string | null };
};

/** Shape returned to desktop clients (GNOME extension, macOS menu bar app). */
export function toTokenSlots(slots: SlotWithProject[]) {
  return slots.map((s) => ({
    slot: s.slot,
    projectSlug: s.project.slug,
    projectName: s.project.name,
    projectShortName: s.project.shortName,
  }));
}

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
