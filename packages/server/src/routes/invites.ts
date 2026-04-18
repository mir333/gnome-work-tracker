import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { organisationService } from "../services/organisation.service";

const invites = new Hono();

invites.use("*", requireAuth);

// List my pending invites
invites.get("/", async (c) => {
  const user = c.get("user");
  const pending = await organisationService.getMyPendingInvites(user.email);
  return c.json(pending);
});

// Accept an invite
invites.post("/:inviteId/accept", async (c) => {
  const userId = c.get("userId");
  const user = c.get("user");
  const org = await organisationService.acceptInvite(
    c.req.param("inviteId"),
    userId,
    user.email
  );
  if (!org)
    return c.json({ error: "Invite not found or already processed" }, 404);
  return c.json(org);
});

// Decline an invite
invites.post("/:inviteId/decline", async (c) => {
  const user = c.get("user");
  const ok = await organisationService.declineInvite(
    c.req.param("inviteId"),
    user.email
  );
  if (!ok)
    return c.json({ error: "Invite not found or already processed" }, 404);
  return c.json({ ok: true });
});

export { invites };
