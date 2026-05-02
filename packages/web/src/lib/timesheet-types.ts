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
