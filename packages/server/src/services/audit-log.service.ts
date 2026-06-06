import { auditLogRepository } from "../repositories/audit-log.repository";

// ---------------------------------------------------------------------------
// Change group constants
// ---------------------------------------------------------------------------

export const AuditAction = {
  WORK_ITEM_CREATED: "WORK_ITEM_CREATED",
  WORK_ITEM_UPDATED: "WORK_ITEM_UPDATED",
  WORK_ITEM_DELETED: "WORK_ITEM_DELETED",
  WORK_ITEM_STARTED: "WORK_ITEM_STARTED",
  WORK_ITEM_STOPPED: "WORK_ITEM_STOPPED",
  WORK_ITEM_AUTO_DELETED: "WORK_ITEM_AUTO_DELETED",
  TIMESHEET_ADJUSTED: "TIMESHEET_ADJUSTED",
  TIMESHEET_ADJUSTMENT_DELETED: "TIMESHEET_ADJUSTMENT_DELETED",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

export const EntityType = {
  WORK_ITEM: "WorkItem",
  TIMESHEET_ENTRY: "TimesheetEntry",
} as const;

export type EntityTypeValue = (typeof EntityType)[keyof typeof EntityType];

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const auditLogService = {
  /**
   * Log an audit entry. Fire-and-forget — errors are caught and logged to
   * console so they never break the calling operation.
   */
  async log(
    userId: string,
    action: AuditActionType,
    entityType: EntityTypeValue,
    entityId: string,
    payload?: Record<string, unknown> | null
  ) {
    try {
      await auditLogRepository.create({
        userId,
        action,
        entityType,
        entityId,
        payload: payload ? JSON.stringify(payload) : null,
      });
    } catch (err) {
      console.error("[AuditLog] Failed to write audit entry:", err);
    }
  },
};
