import { Context, Next } from "hono";
import { auth } from "../auth";
import { organisationMemberRepository } from "../repositories/organisation-member.repository";

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  c.set("user", session.user);
  await next();
}

/**
 * Factory that creates middleware requiring a specific org role.
 * Reads :orgId from route params.
 * Sets "orgRole" on context for downstream use.
 * If no allowedRoles are specified, any member is permitted.
 */
export function requireOrgRole(...allowedRoles: string[]) {
  return async (c: Context, next: Next) => {
    const userId = c.get("userId");
    const orgId = c.req.param("orgId");
    if (!orgId) return c.json({ error: "Missing orgId" }, 400);

    const membership = await organisationMemberRepository.findByOrgAndUser(
      orgId,
      userId
    );
    if (!membership) {
      return c.json({ error: "Not a member of this organisation" }, 403);
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(membership.role)) {
      return c.json({ error: "Insufficient permissions" }, 403);
    }

    c.set("orgRole", membership.role);
    await next();
  };
}
