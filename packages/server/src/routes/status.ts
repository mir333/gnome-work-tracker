import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { workItemService } from "../services/work-item.service";
import { triggerService } from "../services/trigger.service";

const status = new Hono();

status.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const { date, from, to } = c.req.query();

  const active = await workItemService.getActive(userId);

  // Date range query (for weekly/monthly reports)
  if (from && to) {
    const items = await workItemService.getByDateRange(userId, from, to);
    return c.json({ active, items });
  }

  // Specific day query
  if (date) {
    const dayStart = new Date(date + "T00:00:00");
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);
    const items = await workItemService.getByDateRange(
      userId,
      dayStart.toISOString(),
      dayEnd.toISOString()
    );
    return c.json({ active, items });
  }

  // Default: today
  const today = await workItemService.getToday(userId);
  return c.json({ active, today });
});

status.get("/:apiToken", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const active = await workItemService.getActive(profile.userId);
  const today = await workItemService.getToday(profile.userId);
  return c.json({ active, today });
});

export { status };
