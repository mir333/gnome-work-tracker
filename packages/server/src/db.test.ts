import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPrismaClient, SHOW_LOCATION } from "./db";

const dir = mkdtempSync(join(tmpdir(), "wt-db-test-"));
const url = `file:${join(dir, "test.db")}`;
let db: ReturnType<typeof createPrismaClient>;
let itemId: string;
let created: unknown;

beforeAll(async () => {
  const res = Bun.spawnSync(["bunx", "--bun", "prisma", "migrate", "deploy"], {
    cwd: join(import.meta.dir, ".."),
    env: { ...process.env, DATABASE_URL: url },
  });
  if (res.exitCode !== 0) throw new Error(res.stderr.toString());

  db = createPrismaClient(url);
  await db.user.create({ data: { id: "u1", name: "U", email: "u1@example.com" } });
  const project = await db.project.create({ data: { slug: "p1", name: "P", userId: "u1" } });
  const item = await db.workItem.create({
    data: {
      projectId: project.id,
      userId: "u1",
      startedAt: new Date(),
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "trigger",
    },
  });
  itemId = item.id;
  created = item;
});

afterAll(async () => {
  await db?.$disconnect();
  rmSync(dir, { recursive: true, force: true });
});

describe("work item location fields", () => {
  test("are hidden by default, including on create results and includes", async () => {
    const plain = await db.workItem.findUnique({ where: { id: itemId } });
    const withProject = await db.workItem.findMany({ include: { project: true } });
    for (const obj of [created, plain, withProject[0]]) {
      expect(obj).not.toHaveProperty("ipAddress");
      expect(obj).not.toHaveProperty("location");
      expect(obj).not.toHaveProperty("locationSource");
    }
  });

  test("are returned when a query opts in with SHOW_LOCATION", async () => {
    const item = await db.workItem.findUnique({ where: { id: itemId }, omit: SHOW_LOCATION });
    expect(item).toMatchObject({
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "trigger",
    });
  });
});
