import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { timesheetShareService } from "../services/timesheet-share.service";

const timesheetShares = new Hono();

timesheetShares.use("*", requireAuth);

// Create a share link for a project+month
timesheetShares.post("/projects/:id/shares", async (c) => {
  const userId = c.get("userId");
  const { month } = await c.req.json();
  if (!month) return c.json({ error: "month is required" }, 400);

  const share = await timesheetShareService.createShare(
    c.req.param("id"),
    userId,
    month
  );
  if (!share) return c.json({ error: "Not found" }, 404);
  return c.json(share, 201);
});

// List shares for a project (owner only)
timesheetShares.get("/projects/:id/shares", async (c) => {
  const userId = c.get("userId");
  const shares = await timesheetShareService.getSharesByProject(
    c.req.param("id"),
    userId
  );
  if (shares === null) return c.json({ error: "Not found" }, 404);
  return c.json(shares);
});

// Revoke (delete) a share
timesheetShares.delete("/shares/:shareId", async (c) => {
  const userId = c.get("userId");
  await timesheetShareService.revokeShare(c.req.param("shareId"), userId);
  return c.json({ ok: true });
});

// View a shared timesheet (any authenticated user with the token)
timesheetShares.get("/shared/:token", async (c) => {
  const data = await timesheetShareService.getSharedTimesheet(
    c.req.param("token")
  );
  if (!data) return c.json({ error: "Share not found or revoked" }, 404);
  return c.json(data);
});

export { timesheetShares };
