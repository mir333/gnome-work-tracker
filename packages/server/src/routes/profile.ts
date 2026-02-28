import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { userProfileRepository } from "../repositories/user-profile.repository";
import { userSettingsRepository } from "../repositories/user-settings.repository";

const profile = new Hono();

profile.use("*", requireAuth);

profile.get("/", async (c) => {
  const userId = c.get("userId");
  let userProfile = await userProfileRepository.findByUserId(userId);
  if (!userProfile) {
    userProfile = await userProfileRepository.create(userId);
  }
  return c.json({ apiToken: userProfile.apiToken });
});

profile.post("/regenerate-token", async (c) => {
  const userId = c.get("userId");
  const userProfile = await userProfileRepository.regenerateToken(userId);
  return c.json({ apiToken: userProfile.apiToken });
});

profile.get("/settings", async (c) => {
  const userId = c.get("userId");
  const settings = await userSettingsRepository.findByUserId(userId);
  return c.json({ hoursPerManDay: settings?.hoursPerManDay ?? 8 });
});

profile.put("/settings", async (c) => {
  const userId = c.get("userId");
  const { hoursPerManDay } = await c.req.json();
  if (typeof hoursPerManDay !== "number" || hoursPerManDay <= 0) {
    return c.json({ error: "hoursPerManDay must be a positive number" }, 400);
  }
  const settings = await userSettingsRepository.upsert(userId, {
    hoursPerManDay,
  });
  return c.json({ hoursPerManDay: settings.hoursPerManDay });
});

export { profile };
