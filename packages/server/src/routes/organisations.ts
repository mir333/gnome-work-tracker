import { Hono } from "hono";
import { requireAuth, requireOrgRole } from "../middleware/auth";
import { organisationService } from "../services/organisation.service";

const organisations = new Hono();

organisations.use("*", requireAuth);

// ---- Organisation CRUD ----

organisations.get("/", async (c) => {
  const userId = c.get("userId");
  const orgs = await organisationService.listByUser(userId);
  return c.json(orgs);
});

organisations.post("/", async (c) => {
  const userId = c.get("userId");
  const { name } = await c.req.json();
  if (!name) return c.json({ error: "Name is required" }, 400);
  const org = await organisationService.create(userId, name);
  return c.json(org, 201);
});

organisations.get("/:orgId", requireOrgRole(), async (c) => {
  const userId = c.get("userId");
  const org = await organisationService.getById(c.req.param("orgId"), userId);
  if (!org) return c.json({ error: "Not found" }, 404);
  return c.json(org);
});

organisations.put("/:orgId", requireOrgRole("owner"), async (c) => {
  const userId = c.get("userId");
  const data = await c.req.json();
  const org = await organisationService.update(
    c.req.param("orgId"),
    userId,
    data
  );
  if (!org) return c.json({ error: "Not found" }, 404);
  return c.json(org);
});

organisations.delete("/:orgId", requireOrgRole("owner"), async (c) => {
  const userId = c.get("userId");
  const ok = await organisationService.delete(c.req.param("orgId"), userId);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

// ---- Invites ----

organisations.post(
  "/:orgId/invites",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const { email } = await c.req.json();
    if (!email) return c.json({ error: "Email is required" }, 400);
    const result = await organisationService.sendInvite(
      c.req.param("orgId"),
      userId,
      email
    );
    if ("error" in result) return c.json({ error: result.error }, 400);
    return c.json(result.invite, 201);
  }
);

organisations.get(
  "/:orgId/invites",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const invites = await organisationService.getPendingInvitesForOrg(
      c.req.param("orgId"),
      userId
    );
    if (invites === null) return c.json({ error: "Not authorized" }, 403);
    return c.json(invites);
  }
);

organisations.delete(
  "/:orgId/invites/:inviteId",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const ok = await organisationService.cancelInvite(
      c.req.param("inviteId"),
      userId
    );
    if (!ok) return c.json({ error: "Not found" }, 404);
    return c.json({ ok: true });
  }
);

// ---- Members ----

organisations.get("/:orgId/members", requireOrgRole(), async (c) => {
  const userId = c.get("userId");
  const members = await organisationService.listMembers(
    c.req.param("orgId"),
    userId
  );
  if (!members) return c.json({ error: "Not found" }, 404);
  return c.json(members);
});

organisations.put(
  "/:orgId/members/:memberId/role",
  requireOrgRole("owner"),
  async (c) => {
    const userId = c.get("userId");
    const { role } = await c.req.json();
    const result = await organisationService.changeRole(
      c.req.param("orgId"),
      userId,
      c.req.param("memberId"),
      role
    );
    if ("error" in result) return c.json({ error: result.error }, 400);
    return c.json(result);
  }
);

organisations.delete(
  "/:orgId/members/:memberId",
  requireOrgRole(),
  async (c) => {
    const userId = c.get("userId");
    const result = await organisationService.removeMember(
      c.req.param("orgId"),
      userId,
      c.req.param("memberId")
    );
    if ("error" in result) return c.json({ error: result.error }, 400);
    return c.json(result);
  }
);

// ---- Reports (owner/manager only) ----

organisations.get(
  "/:orgId/report",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const { from, to } = c.req.query();
    if (!from || !to)
      return c.json({ error: "from and to are required" }, 400);
    const data = await organisationService.getOrgReport(
      c.req.param("orgId"),
      userId,
      from,
      to
    );
    if (!data) return c.json({ error: "Not authorized" }, 403);
    return c.json(data);
  }
);

organisations.get(
  "/:orgId/members/:memberId/projects",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const projects = await organisationService.getMemberProjects(
      c.req.param("orgId"),
      userId,
      c.req.param("memberId")
    );
    if (!projects)
      return c.json({ error: "Not authorized or member not found" }, 403);
    return c.json(projects);
  }
);

organisations.get(
  "/:orgId/members/:memberId/work-items",
  requireOrgRole("owner", "manager"),
  async (c) => {
    const userId = c.get("userId");
    const { from, to } = c.req.query();
    const items = await organisationService.getMemberWorkItems(
      c.req.param("orgId"),
      userId,
      c.req.param("memberId"),
      from,
      to
    );
    if (!items)
      return c.json({ error: "Not authorized or member not found" }, 403);
    return c.json(items);
  }
);

export { organisations };
