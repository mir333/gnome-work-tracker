import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { triggerService } from "../services/trigger.service";

const trigger = new Hono();

// Session-based trigger (for web dashboard)
trigger.get("/session/stop", requireAuth, async (c) => {
  const userId = c.get("userId");
  await triggerService.stopAll(userId);
  return c.json({ ok: true, active: null });
});

trigger.get("/session/:slug", requireAuth, async (c) => {
  const userId = c.get("userId");
  const workItem = await triggerService.startWork(userId, c.req.param("slug"));
  if (!workItem) return c.json({ error: "Project not found" }, 404);
  return c.json({ ok: true, workItem });
});

// Token-based trigger (for GNOME extension)
trigger.get("/:apiToken/stop", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  await triggerService.stopAll(profile.userId);
  return c.json({ ok: true, active: null });
});

trigger.get("/:apiToken/:slug", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const workItem = await triggerService.startWork(
    profile.userId,
    c.req.param("slug")
  );
  if (!workItem) return c.json({ error: "Project not found" }, 404);
  return c.json({ ok: true, workItem });
});

// Token-based work item update (for GNOME extension)
trigger.put("/:apiToken/work-items/:id", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const data = await c.req.json();
  const workItem = await triggerService.updateWorkItem(
    profile.userId,
    c.req.param("id"),
    data
  );
  if (!workItem) return c.json({ error: "Work item not found" }, 404);
  return c.json({ ok: true, workItem });
});

export { trigger };
