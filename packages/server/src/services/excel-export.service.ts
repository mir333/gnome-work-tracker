import ExcelJS from "exceljs";
import { timesheetService } from "./timesheet.service";

export const excelExportService = {
  async generateTimesheetExcel(
    userId: string,
    fromDate: string,
    toDate: string,
    projectId?: string
  ): Promise<Buffer> {
    const timesheet = await timesheetService.getTimesheet(
      userId,
      fromDate,
      toDate,
      projectId
    );

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "GNOME Work Tracker";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet("Timesheet");

    // Columns
    sheet.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Day", key: "dayName", width: 6 },
      { header: "Project", key: "projectName", width: 24 },
      { header: "Raw Hours", key: "rawHours", width: 12 },
      { header: "Hours", key: "effectiveHours", width: 12 },
      { header: "Description", key: "description", width: 40 },
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" },
    };

    // Data rows
    for (const entry of timesheet.entries) {
      const row = sheet.addRow({
        date: entry.date,
        dayName: entry.dayName,
        projectName: entry.projectName,
        rawHours: Number((entry.rawMinutes / 60).toFixed(2)),
        effectiveHours: Number((entry.effectiveMinutes / 60).toFixed(2)),
        description: entry.description === "\u2014" ? "" : entry.description,
      });

      // Highlight adjusted rows
      if (entry.isAdjusted) {
        row.getCell("effectiveHours").font = { bold: true, color: { argb: "FF2563EB" } };
      }
    }

    // Total row
    const totalRow = sheet.addRow({
      date: "",
      dayName: "",
      projectName: "TOTAL",
      rawHours: Number((timesheet.totalRawMinutes / 60).toFixed(2)),
      effectiveHours: Number((timesheet.totalEffectiveMinutes / 60).toFixed(2)),
      description: `${timesheet.manDays} man-days (${timesheet.hoursPerManDay}h/MD)`,
    });
    totalRow.font = { bold: true };
    totalRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF0F0F0" },
    };

    // Number format for hours columns
    sheet.getColumn("rawHours").numFmt = "0.00";
    sheet.getColumn("effectiveHours").numFmt = "0.00";

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  },
};
