import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { projectService } from "../services/project.service";

const projects = new Hono();

projects.use("*", requireAuth);

projects.get("/", async (c) => {
  const userId = c.get("userId");
  const list = await projectService.list(userId);
  return c.json(list);
});

projects.post("/", async (c) => {
  const userId = c.get("userId");
  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);
  const project = await projectService.create(userId, name);
  return c.json(project, 201);
});

projects.get("/:id", async (c) => {
  const userId = c.get("userId");
  const project = await projectService.getById(c.req.param("id"), userId);
  if (!project) return c.json({ error: "Not found" }, 404);
  return c.json(project);
});

projects.put("/:id", async (c) => {
  const userId = c.get("userId");
  const data = await c.req.json();
  try {
    const project = await projectService.update(c.req.param("id"), userId, data);
    if (!project) return c.json({ error: "Not found" }, 404);
    return c.json(project);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

projects.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const ok = await projectService.delete(c.req.param("id"), userId);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

export { projects };
