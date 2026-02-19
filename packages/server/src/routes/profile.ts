import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { userProfileRepository } from "../repositories/user-profile.repository";

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

export { profile };
