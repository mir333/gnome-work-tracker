import { timesheetShareRepository } from "../repositories/timesheet-share.repository";
import { projectRepository } from "../repositories/project.repository";
import { workItemRepository } from "../repositories/work-item.repository";

export const timesheetShareService = {
  async createShare(projectId: string, userId: string, month: string) {
    // Verify project ownership
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    // Return existing share if one already exists for this project+month
    const existing = await timesheetShareRepository.findByProjectAndMonth(
      projectId,
      month
    );
    if (existing) return existing;

    return timesheetShareRepository.create({ projectId, userId, month });
  },

  async revokeShare(shareId: string, userId: string) {
    const shares = await timesheetShareRepository.findByToken(shareId);
    // For safety, we look up by ID through all shares
    // But we accept shareId as the record ID directly
    await timesheetShareRepository.delete(shareId);
    return true;
  },

  async getSharesByProject(projectId: string, userId: string) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;
    return timesheetShareRepository.findAllByProject(projectId);
  },

  async getSharedTimesheet(token: string) {
    const share = await timesheetShareRepository.findByToken(token);
    if (!share || !share.active) return null;

    // Parse month "YYYY-MM" into date range
    const [year, mon] = share.month.split("-").map(Number);
    const dateFrom = new Date(year, mon - 1, 1);
    const dateTo = new Date(year, mon, 0, 23, 59, 59);

    const workItems = await workItemRepository.findByProject(
      share.projectId,
      dateFrom,
      dateTo
    );

    return {
      project: share.project,
      month: share.month,
      workItems,
    };
  },
};
