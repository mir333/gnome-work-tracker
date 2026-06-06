import { workItemRepository } from "../repositories/work-item.repository";
import { timesheetEntryRepository } from "../repositories/timesheet-entry.repository";
import { projectRepository } from "../repositories/project.repository";
import { userSettingsRepository } from "../repositories/user-settings.repository";
import {
  auditLogService,
  AuditAction,
  EntityType,
} from "./audit-log.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimesheetDayEntry {
  date: string;
  dayName: string;
  projectId: string;
  projectName: string;
  rawMinutes: number;
  adjustedMinutes: number | null;
  effectiveMinutes: number;
  isAdjusted: boolean;
  rawDescription: string;
  description: string;
  timesheetEntryId: string | null;
}

export interface TimesheetResult {
  entries: TimesheetDayEntry[];
  totalRawMinutes: number;
  totalEffectiveMinutes: number;
  hoursPerManDay: number;
  manDays: number;
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shortDayName(d: Date): string {
  return d.toLocaleDateString("en-US", { weekday: "short" });
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const timesheetService = {
  /**
   * Compute the merged timesheet for a user over a date range.
   * Single source of truth — replaces all frontend aggregateByDay() functions.
   */
  async getTimesheet(
    userId: string,
    fromDate: string,
    toDate: string,
    projectId?: string
  ): Promise<TimesheetResult> {
    // 1. Fetch raw work items
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T23:59:59.999");

    const workItems = projectId
      ? await workItemRepository.findByProject(projectId, from, to)
      : await workItemRepository.findByUserAndDateRange(userId, from, to);

    // 2. If single project, look up the project name
    let singleProjectName: string | null = null;
    if (projectId) {
      const proj = await projectRepository.findById(projectId);
      singleProjectName = proj?.name ?? projectId;
    }

    // 3. Aggregate raw data by (date, projectId)
    const rawMap = new Map<
      string,
      {
        projectId: string;
        projectName: string;
        totalMins: number;
        descriptions: Set<string>;
      }
    >();

    for (const item of workItems) {
      const dateKey = toDateString(new Date(item.startedAt));
      const pId = item.projectId;
      const key = `${dateKey}|${pId}`;

      const entry = rawMap.get(key) || {
        projectId: pId,
        projectName:
          singleProjectName ??
          (item as any).project?.name ??
          pId,
        totalMins: 0,
        descriptions: new Set<string>(),
      };

      const s = new Date(item.startedAt).getTime();
      const e = item.endedAt ? new Date(item.endedAt).getTime() : Date.now();
      entry.totalMins += Math.max(0, Math.floor((e - s) / 60000));

      const desc = (item as any).description ?? item.description;
      if (desc?.trim()) {
        entry.descriptions.add(desc.trim());
      }

      rawMap.set(key, entry);
    }

    // 4. Fetch timesheet entry adjustments
    const adjustments = await timesheetEntryRepository.findByUserAndDateRange(
      userId,
      fromDate,
      toDate
    );

    const adjMap = new Map<string, (typeof adjustments)[number]>();
    for (const adj of adjustments) {
      if (projectId && adj.projectId !== projectId) continue;
      adjMap.set(`${adj.date}|${adj.projectId}`, adj);
    }

    // 5. Merge: raw entries + adjustments
    const allKeys = new Set([...rawMap.keys(), ...adjMap.keys()]);
    const entries: TimesheetDayEntry[] = [];

    for (const key of allKeys) {
      const [date, pId] = key.split("|");
      const raw = rawMap.get(key);
      const adj = adjMap.get(key);

      const rawMinutes = raw?.totalMins ?? 0;
      const rawDescription = raw
        ? Array.from(raw.descriptions).join("; ")
        : "";
      const adjustedMinutes = adj?.adjustedMinutes ?? null;
      const effectiveMinutes = adjustedMinutes ?? rawMinutes;
      const description = adj?.description ?? rawDescription;
      const projectName =
        raw?.projectName ?? (adj as any)?.project?.name ?? pId;

      entries.push({
        date,
        dayName: shortDayName(new Date(date + "T12:00:00")),
        projectId: pId,
        projectName,
        rawMinutes,
        adjustedMinutes,
        effectiveMinutes,
        isAdjusted: adjustedMinutes !== null,
        rawDescription,
        description: description || "\u2014",
        timesheetEntryId: adj?.id ?? null,
      });
    }

    entries.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        a.projectName.localeCompare(b.projectName)
    );

    // 6. Compute totals
    const totalRawMinutes = entries.reduce((sum, e) => sum + e.rawMinutes, 0);
    const totalEffectiveMinutes = entries.reduce(
      (sum, e) => sum + e.effectiveMinutes,
      0
    );

    const settings = await userSettingsRepository.findByUserId(userId);
    const hoursPerManDay = settings?.hoursPerManDay ?? 8;
    const manDays =
      Math.round((totalEffectiveMinutes / 60 / hoursPerManDay) * 10) / 10;

    return {
      entries,
      totalRawMinutes,
      totalEffectiveMinutes,
      hoursPerManDay,
      manDays,
    };
  },

  /**
   * Upsert a timesheet adjustment entry.
   */
  async upsertEntry(
    userId: string,
    projectId: string,
    date: string,
    adjustedMinutes: number,
    description?: string | null
  ) {
    // Validate project belongs to user
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    // Fetch existing entry (if any) for before-state in audit log
    const existing = await timesheetEntryRepository.findByUserProjectAndDate(
      userId,
      projectId,
      date
    );

    const result = await timesheetEntryRepository.upsert({
      userId,
      projectId,
      date,
      adjustedMinutes,
      description,
    });

    auditLogService.log(userId, AuditAction.TIMESHEET_ADJUSTED, EntityType.TIMESHEET_ENTRY, result.id, {
      projectId,
      date,
      before: existing
        ? {
            adjustedMinutes: existing.adjustedMinutes,
            description: existing.description ?? null,
          }
        : null,
      after: {
        adjustedMinutes,
        description: description ?? null,
      },
    });

    return result;
  },

  /**
   * Delete a timesheet adjustment (revert to raw).
   */
  async deleteEntry(id: string, userId: string) {
    const entry = await timesheetEntryRepository.findById(id);
    if (!entry || entry.userId !== userId) return false;

    await timesheetEntryRepository.delete(id);

    auditLogService.log(userId, AuditAction.TIMESHEET_ADJUSTMENT_DELETED, EntityType.TIMESHEET_ENTRY, id, {
      projectId: entry.projectId,
      date: entry.date,
      adjustedMinutes: entry.adjustedMinutes,
      description: entry.description ?? null,
    });

    return true;
  },
};
