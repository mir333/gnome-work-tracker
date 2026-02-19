import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { workItemService } from "../services/work-item.service";

const workItems = new Hono();

workItems.use("*", requireAuth);

workItems.get("/projects/:id/work-items", async (c) => {
  const userId = c.get("userId");
  const { dateFrom, dateTo } = c.req.query();
  const items = await workItemService.listByProject(
    c.req.param("id"),
    userId,
    dateFrom,
    dateTo
  );
  if (items === null) return c.json({ error: "Not found" }, 404);
  return c.json(items);
});

workItems.post("/projects/:id/work-items", async (c) => {
  const userId = c.get("userId");
  const { startedAt, endedAt, description } = await c.req.json();
  if (!startedAt || !endedAt) {
    return c.json({ error: "startedAt and endedAt are required" }, 400);
  }
  try {
    const item = await workItemService.createManual(
      c.req.param("id"),
      userId,
      startedAt,
      endedAt,
      description
    );
    if (!item) return c.json({ error: "Project not found" }, 404);
    return c.json(item, 201);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

workItems.put("/work-items/:id", async (c) => {
  const userId = c.get("userId");
  const data = await c.req.json();
  const item = await workItemService.update(c.req.param("id"), userId, data);
  return c.json(item);
});

workItems.delete("/work-items/:id", async (c) => {
  await workItemService.delete(c.req.param("id"));
  return c.json({ ok: true });
});

export { workItems };
