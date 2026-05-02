import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { timesheetService } from "../services/timesheet.service";
import { excelExportService } from "../services/excel-export.service";

const timesheet = new Hono();

timesheet.use("*", requireAuth);

// GET /api/timesheet?from=YYYY-MM-DD&to=YYYY-MM-DD&projectId=xxx
timesheet.get("/", async (c) => {
  const userId = c.get("userId");
  const { from, to, projectId } = c.req.query();
  if (!from || !to) return c.json({ error: "from and to are required" }, 400);

  const result = await timesheetService.getTimesheet(
    userId,
    from,
    to,
    projectId || undefined
  );
  return c.json(result);
});

// PUT /api/timesheet/entries — upsert a timesheet adjustment
timesheet.put("/entries", async (c) => {
  const userId = c.get("userId");
  const { projectId, date, adjustedMinutes, description } =
    await c.req.json();

  if (!projectId || !date || adjustedMinutes === undefined) {
    return c.json(
      { error: "projectId, date, and adjustedMinutes are required" },
      400
    );
  }
  if (typeof adjustedMinutes !== "number" || adjustedMinutes < 0) {
    return c.json(
      { error: "adjustedMinutes must be a non-negative number" },
      400
    );
  }

  const entry = await timesheetService.upsertEntry(
    userId,
    projectId,
    date,
    adjustedMinutes,
    description
  );
  if (!entry) return c.json({ error: "Project not found" }, 404);
  return c.json(entry);
});

// DELETE /api/timesheet/entries/:id — remove an adjustment (revert to raw)
timesheet.delete("/entries/:id", async (c) => {
  const userId = c.get("userId");
  const ok = await timesheetService.deleteEntry(c.req.param("id"), userId);
  if (!ok) return c.json({ error: "Entry not found" }, 404);
  return c.json({ ok: true });
});

// GET /api/timesheet/export/excel?from=YYYY-MM-DD&to=YYYY-MM-DD&projectId=xxx
timesheet.get("/export/excel", async (c) => {
  const userId = c.get("userId");
  const { from, to, projectId } = c.req.query();
  if (!from || !to) return c.json({ error: "from and to are required" }, 400);

  const buffer = await excelExportService.generateTimesheetExcel(
    userId,
    from,
    to,
    projectId || undefined
  );

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="timesheet-${from}-to-${to}.xlsx"`,
    },
  });
});

export { timesheet };
