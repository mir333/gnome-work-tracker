import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { workItemService } from "../services/work-item.service";
import { triggerService } from "../services/trigger.service";

const status = new Hono();

status.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const active = await workItemService.getActive(userId);
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
