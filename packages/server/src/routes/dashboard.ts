import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { dashboardService } from "../services/dashboard.service";
import { triggerService } from "../services/trigger.service";

const dashboard = new Hono();

// Session-authenticated routes
dashboard.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const slots = await dashboardService.getSlots(userId);
  return c.json(slots);
});

dashboard.put("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const { slots } = await c.req.json();
  try {
    const result = await dashboardService.updateSlots(userId, slots);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Token-authenticated route (for GNOME extension)
dashboard.get("/:apiToken", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const slots = await dashboardService.getSlots(profile.userId);
  return c.json(
    slots.map((s: any) => ({
      slot: s.slot,
      projectSlug: s.project.slug,
      projectName: s.project.name,
    }))
  );
});

export { dashboard };
