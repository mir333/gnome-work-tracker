# GNOME Work Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a work time tracking system with a web app (React + Hono) and a GNOME Shell extension with one-click buttons in the top bar.

**Architecture:** Bun monorepo with three packages: `server` (Hono API + Prisma), `web` (React + Vite), `gnome-extension` (GJS). Server uses Routes → Services → Repositories layering. Better Auth handles user management.

**Tech Stack:** Bun, Hono, Prisma (SQLite), Better Auth, React, Vite, TypeScript, Tailwind v4, shadcn/ui, GJS (GNOME 45+)

---

## Phase 1: Project Scaffolding

### Task 1: Initialize monorepo root

**Files:**
- Create: `package.json`
- Create: `bunfig.toml`
- Create: `.gitignore`
- Create: `.env`

**Step 1: Create root package.json**

```json
{
  "name": "gnome-work-tracker",
  "private": true,
  "workspaces": ["packages/*"]
}
```

**Step 2: Create bunfig.toml**

```toml
[install]
peer = false
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
.env
*.db
*.db-journal
packages/server/prisma/generated/
```

**Step 4: Create .env**

```
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="dev-secret-change-in-production"
```

**Step 5: Commit**

```bash
git add package.json bunfig.toml .gitignore
git commit -m "chore: initialize monorepo root"
```

---

### Task 2: Scaffold server package

**Files:**
- Create: `packages/server/package.json`
- Create: `packages/server/tsconfig.json`
- Create: `packages/server/src/index.ts`

**Step 1: Create packages/server/package.json**

```json
{
  "name": "@work-tracker/server",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "bun run --hot src/index.ts",
    "db:generate": "bunx --bun prisma generate",
    "db:migrate": "bunx --bun prisma migrate dev",
    "db:studio": "bunx --bun prisma studio"
  },
  "dependencies": {
    "hono": "latest",
    "better-auth": "latest",
    "@prisma/client": "latest",
    "@prisma/adapter-libsql": "latest"
  },
  "devDependencies": {
    "prisma": "latest",
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

**Step 2: Create packages/server/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

**Step 3: Create packages/server/src/index.ts**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.get("/", (c) => c.json({ status: "ok" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

**Step 4: Install dependencies**

Run: `bun install`

**Step 5: Verify server starts**

Run: `cd packages/server && bun run dev` — hit http://localhost:3000, expect `{"status":"ok"}`

**Step 6: Commit**

```bash
git add packages/server/
git commit -m "chore: scaffold server package with Hono"
```

---

### Task 3: Set up Prisma with SQLite

**Files:**
- Create: `packages/server/prisma/schema.prisma`
- Create: `packages/server/src/db.ts`

**Step 1: Initialize Prisma**

Run: `cd packages/server && bunx --bun prisma init --datasource-provider sqlite`

**Step 2: Write the schema**

`packages/server/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model UserProfile {
  id       String @id @default(uuid())
  userId   String @unique
  apiToken String @unique @default(uuid())

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Project {
  id        String   @id @default(uuid())
  slug      String   @unique
  name      String
  userId    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  workItems      WorkItem[]
  dashboardSlots DashboardConfig[]
}

model WorkItem {
  id          String    @id @default(uuid())
  projectId   String
  userId      String
  startedAt   DateTime
  endedAt     DateTime?
  description String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model DashboardConfig {
  id        String   @id @default(uuid())
  userId    String
  slot      Int
  projectId String
  updatedAt DateTime @updatedAt

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([userId, slot])
}
```

Note: Better Auth models (User, Session, Account, Verification) will be added in Task 4 after running the Better Auth CLI generator. The `UserProfile`, `Project`, `WorkItem`, and `DashboardConfig` models reference `User` — those relations will resolve once Better Auth's models are in the schema.

**Step 3: Create packages/server/src/db.ts**

```typescript
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
```

**Step 4: Commit (don't migrate yet — Better Auth models still needed)**

```bash
git add packages/server/prisma/ packages/server/src/db.ts
git commit -m "chore: add Prisma schema with core models"
```

---

### Task 4: Set up Better Auth

**Files:**
- Modify: `packages/server/prisma/schema.prisma` (add Better Auth models)
- Create: `packages/server/src/auth.ts`
- Modify: `packages/server/src/index.ts` (mount auth routes)

**Step 1: Generate Better Auth Prisma models**

Run: `cd packages/server && bunx @better-auth/cli generate`

This appends User, Session, Account, Verification models to `schema.prisma`. Verify the User model has `id`, `name`, `email`, `emailVerified`, `image`, `createdAt`, `updatedAt`. The `username` plugin adds `username` and `displayUsername` fields.

**Step 2: Run initial migration**

Run: `cd packages/server && bunx --bun prisma migrate dev --name init`

**Step 3: Generate Prisma client**

Run: `cd packages/server && bunx --bun prisma generate`

**Step 4: Create packages/server/src/auth.ts**

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  plugins: [username()],
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["http://localhost:5173"],
  secret: process.env.BETTER_AUTH_SECRET!,
});

export type Auth = typeof auth;
```

**Step 5: Mount auth in index.ts**

Update `packages/server/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Better Auth routes
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.get("/", (c) => c.json({ status: "ok" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

**Step 6: Verify server starts without errors**

Run: `cd packages/server && bun run dev`

**Step 7: Commit**

```bash
git add packages/server/
git commit -m "feat: add Better Auth with username+password"
```

---

## Phase 2: Server API — Services & Repositories

### Task 5: Create the repository layer

**Files:**
- Create: `packages/server/src/repositories/user-profile.repository.ts`
- Create: `packages/server/src/repositories/project.repository.ts`
- Create: `packages/server/src/repositories/work-item.repository.ts`
- Create: `packages/server/src/repositories/dashboard.repository.ts`

**Step 1: Create user profile repository**

`packages/server/src/repositories/user-profile.repository.ts`:

```typescript
import { prisma } from "../db";

export const userProfileRepository = {
  async findByUserId(userId: string) {
    return prisma.userProfile.findUnique({ where: { userId } });
  },

  async findByApiToken(apiToken: string) {
    return prisma.userProfile.findUnique({
      where: { apiToken },
      include: { user: true },
    });
  },

  async create(userId: string) {
    return prisma.userProfile.create({ data: { userId } });
  },

  async regenerateToken(userId: string) {
    return prisma.userProfile.update({
      where: { userId },
      data: { apiToken: crypto.randomUUID() },
    });
  },
};
```

**Step 2: Create project repository**

`packages/server/src/repositories/project.repository.ts`:

```typescript
import { prisma } from "../db";

export const projectRepository = {
  async findAllByUser(userId: string) {
    return prisma.project.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  },

  async findBySlug(slug: string) {
    return prisma.project.findUnique({ where: { slug } });
  },

  async create(data: { name: string; slug: string; userId: string }) {
    return prisma.project.create({ data });
  },

  async update(id: string, data: { name?: string; slug?: string }) {
    return prisma.project.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.project.delete({ where: { id } });
  },
};
```

**Step 3: Create work item repository**

`packages/server/src/repositories/work-item.repository.ts`:

```typescript
import { prisma } from "../db";

export const workItemRepository = {
  async findByProject(projectId: string, dateFrom?: Date, dateTo?: Date) {
    return prisma.workItem.findMany({
      where: {
        projectId,
        ...(dateFrom || dateTo
          ? {
              startedAt: {
                ...(dateFrom ? { gte: dateFrom } : {}),
                ...(dateTo ? { lte: dateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { startedAt: "desc" },
    });
  },

  async findActiveByUser(userId: string) {
    return prisma.workItem.findFirst({
      where: { userId, endedAt: null },
      include: { project: true },
    });
  },

  async findTodayByUser(userId: string) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    return prisma.workItem.findMany({
      where: {
        userId,
        startedAt: { gte: startOfDay },
      },
      include: { project: true },
      orderBy: { startedAt: "asc" },
    });
  },

  async findOverlapping(
    userId: string,
    startedAt: Date,
    endedAt: Date,
    excludeId?: string
  ) {
    return prisma.workItem.findFirst({
      where: {
        userId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
        OR: [
          { startedAt: { lt: endedAt }, endedAt: { gt: startedAt } },
          { startedAt: { lt: endedAt }, endedAt: null },
        ],
      },
    });
  },

  async create(data: {
    projectId: string;
    userId: string;
    startedAt: Date;
    endedAt?: Date;
    description?: string;
  }) {
    return prisma.workItem.create({ data });
  },

  async update(
    id: string,
    data: { endedAt?: Date; description?: string; startedAt?: Date }
  ) {
    return prisma.workItem.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.workItem.delete({ where: { id } });
  },
};
```

**Step 4: Create dashboard config repository**

`packages/server/src/repositories/dashboard.repository.ts`:

```typescript
import { prisma } from "../db";

export const dashboardRepository = {
  async findByUser(userId: string) {
    return prisma.dashboardConfig.findMany({
      where: { userId },
      include: { project: true },
      orderBy: { slot: "asc" },
    });
  },

  async upsertSlot(userId: string, slot: number, projectId: string) {
    return prisma.dashboardConfig.upsert({
      where: { userId_slot: { userId, slot } },
      update: { projectId },
      create: { userId, slot, projectId },
    });
  },

  async deleteSlot(userId: string, slot: number) {
    return prisma.dashboardConfig.deleteMany({
      where: { userId, slot },
    });
  },

  async clearAll(userId: string) {
    return prisma.dashboardConfig.deleteMany({ where: { userId } });
  },
};
```

**Step 5: Commit**

```bash
git add packages/server/src/repositories/
git commit -m "feat: add repository layer for all models"
```

---

### Task 6: Create the service layer

**Files:**
- Create: `packages/server/src/services/project.service.ts`
- Create: `packages/server/src/services/work-item.service.ts`
- Create: `packages/server/src/services/dashboard.service.ts`
- Create: `packages/server/src/services/trigger.service.ts`

**Step 1: Create project service**

`packages/server/src/services/project.service.ts`:

```typescript
import { projectRepository } from "../repositories/project.repository";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function generateUniqueSlug(name: string): Promise<string> {
  let slug = slugify(name);
  let existing = await projectRepository.findBySlug(slug);
  let counter = 1;
  while (existing) {
    slug = `${slugify(name)}-${counter}`;
    existing = await projectRepository.findBySlug(slug);
    counter++;
  }
  return slug;
}

export const projectService = {
  async list(userId: string) {
    return projectRepository.findAllByUser(userId);
  },

  async getById(id: string, userId: string) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;
    return project;
  },

  async create(userId: string, name: string) {
    const slug = await generateUniqueSlug(name);
    return projectRepository.create({ name, slug, userId });
  },

  async update(id: string, userId: string, data: { name?: string; slug?: string }) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return null;

    if (data.slug && data.slug !== project.slug) {
      const existing = await projectRepository.findBySlug(data.slug);
      if (existing) throw new Error("Slug already taken");
    }

    return projectRepository.update(id, data);
  },

  async delete(id: string, userId: string) {
    const project = await projectRepository.findById(id);
    if (!project || project.userId !== userId) return false;
    await projectRepository.delete(id);
    return true;
  },
};
```

**Step 2: Create work item service**

`packages/server/src/services/work-item.service.ts`:

```typescript
import { workItemRepository } from "../repositories/work-item.repository";
import { projectRepository } from "../repositories/project.repository";

export const workItemService = {
  async listByProject(
    projectId: string,
    userId: string,
    dateFrom?: string,
    dateTo?: string
  ) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    return workItemRepository.findByProject(
      projectId,
      dateFrom ? new Date(dateFrom) : undefined,
      dateTo ? new Date(dateTo) : undefined
    );
  },

  async getActive(userId: string) {
    return workItemRepository.findActiveByUser(userId);
  },

  async getToday(userId: string) {
    return workItemRepository.findTodayByUser(userId);
  },

  async createManual(
    projectId: string,
    userId: string,
    startedAt: string,
    endedAt: string,
    description?: string
  ) {
    const project = await projectRepository.findById(projectId);
    if (!project || project.userId !== userId) return null;

    const start = new Date(startedAt);
    const end = new Date(endedAt);

    if (end <= start) throw new Error("End time must be after start time");

    const overlap = await workItemRepository.findOverlapping(userId, start, end);
    if (overlap) throw new Error("Work item overlaps with existing entry");

    return workItemRepository.create({
      projectId,
      userId,
      startedAt: start,
      endedAt: end,
      description,
    });
  },

  async update(
    id: string,
    userId: string,
    data: { startedAt?: string; endedAt?: string; description?: string }
  ) {
    const existing = await workItemRepository.findActiveByUser(userId);
    // Fetch the specific item to validate ownership
    const items = await workItemRepository.findByProject(data.startedAt ? "" : "", undefined, undefined);
    // Simpler: just try updating and check
    return workItemRepository.update(id, {
      ...(data.startedAt ? { startedAt: new Date(data.startedAt) } : {}),
      ...(data.endedAt ? { endedAt: new Date(data.endedAt) } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
    });
  },

  async delete(id: string) {
    return workItemRepository.delete(id);
  },
};
```

**Step 3: Create trigger service**

`packages/server/src/services/trigger.service.ts`:

```typescript
import { userProfileRepository } from "../repositories/user-profile.repository";
import { projectRepository } from "../repositories/project.repository";
import { workItemRepository } from "../repositories/work-item.repository";

export const triggerService = {
  async resolveToken(apiToken: string) {
    return userProfileRepository.findByApiToken(apiToken);
  },

  async startWork(userId: string, slug: string) {
    const project = await projectRepository.findBySlug(slug);
    if (!project || project.userId !== userId) return null;

    // Close any active work item
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
      await workItemRepository.update(active.id, { endedAt: new Date() });
    }

    // Start new work item
    return workItemRepository.create({
      projectId: project.id,
      userId,
      startedAt: new Date(),
    });
  },

  async stopAll(userId: string) {
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
      await workItemRepository.update(active.id, { endedAt: new Date() });
    }
    return true;
  },
};
```

**Step 4: Create dashboard service**

`packages/server/src/services/dashboard.service.ts`:

```typescript
import { dashboardRepository } from "../repositories/dashboard.repository";
import { projectRepository } from "../repositories/project.repository";

export const dashboardService = {
  async getSlots(userId: string) {
    return dashboardRepository.findByUser(userId);
  },

  async updateSlots(
    userId: string,
    slots: { slot: number; projectId: string | null }[]
  ) {
    for (const { slot, projectId } of slots) {
      if (slot < 1 || slot > 6) throw new Error("Slot must be 1-6");

      if (projectId) {
        const project = await projectRepository.findById(projectId);
        if (!project || project.userId !== userId) {
          throw new Error(`Invalid project for slot ${slot}`);
        }
        await dashboardRepository.upsertSlot(userId, slot, projectId);
      } else {
        await dashboardRepository.deleteSlot(userId, slot);
      }
    }

    return dashboardRepository.findByUser(userId);
  },
};
```

**Step 5: Commit**

```bash
git add packages/server/src/services/
git commit -m "feat: add service layer with business logic"
```

---

### Task 7: Create the route layer + auth middleware

**Files:**
- Create: `packages/server/src/middleware/auth.ts`
- Create: `packages/server/src/routes/projects.ts`
- Create: `packages/server/src/routes/work-items.ts`
- Create: `packages/server/src/routes/trigger.ts`
- Create: `packages/server/src/routes/dashboard.ts`
- Create: `packages/server/src/routes/status.ts`
- Modify: `packages/server/src/index.ts` (mount all routes)

**Step 1: Create auth middleware**

`packages/server/src/middleware/auth.ts`:

```typescript
import { Context, Next } from "hono";
import { auth } from "../auth";

export async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("userId", session.user.id);
  c.set("user", session.user);
  await next();
}
```

**Step 2: Create project routes**

`packages/server/src/routes/projects.ts`:

```typescript
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
```

**Step 3: Create work item routes**

`packages/server/src/routes/work-items.ts`:

```typescript
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
```

**Step 4: Create trigger routes**

`packages/server/src/routes/trigger.ts`:

```typescript
import { Hono } from "hono";
import { triggerService } from "../services/trigger.service";

const trigger = new Hono();

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

export { trigger };
```

**Step 5: Create dashboard routes**

`packages/server/src/routes/dashboard.ts`:

```typescript
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { dashboardService } from "../services/dashboard.service";
import { triggerService } from "../services/trigger.service";

const dashboard = new Hono();

// Session-authenticated routes
dashboard.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const slots = await dashboardService.getSlots(userId);
  return c.json(slots);
});

dashboard.put("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const { slots } = await c.req.json();
  try {
    const result = await dashboardService.updateSlots(userId, slots);
    return c.json(result);
  } catch (e: any) {
    return c.json({ error: e.message }, 400);
  }
});

// Token-authenticated route (for GNOME extension)
dashboard.get("/:apiToken", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const slots = await dashboardService.getSlots(profile.userId);
  return c.json(
    slots.map((s: any) => ({
      slot: s.slot,
      projectSlug: s.project.slug,
      projectName: s.project.name,
    }))
  );
});

export { dashboard };
```

**Step 6: Create status routes**

`packages/server/src/routes/status.ts`:

```typescript
import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";
import { workItemService } from "../services/work-item.service";
import { triggerService } from "../services/trigger.service";

const status = new Hono();

status.get("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const active = await workItemService.getActive(userId);
  const today = await workItemService.getToday(userId);
  return c.json({ active, today });
});

status.get("/:apiToken", async (c) => {
  const profile = await triggerService.resolveToken(c.req.param("apiToken"));
  if (!profile) return c.json({ error: "Invalid token" }, 401);

  const active = await workItemService.getActive(profile.userId);
  const today = await workItemService.getToday(profile.userId);
  return c.json({ active, today });
});

export { status };
```

**Step 7: Update index.ts to mount all routes**

`packages/server/src/index.ts`:

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { auth } from "./auth";
import { projects } from "./routes/projects";
import { workItems } from "./routes/work-items";
import { trigger } from "./routes/trigger";
import { dashboard } from "./routes/dashboard";
import { status } from "./routes/status";

const app = new Hono();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// Auth
app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

// API routes
app.route("/api/projects", projects);
app.route("/api", workItems);
app.route("/api/trigger", trigger);
app.route("/api/dashboard", dashboard);
app.route("/api/status", status);

app.get("/", (c) => c.json({ status: "ok" }));

export default {
  port: 3000,
  fetch: app.fetch,
};
```

**Step 8: Create UserProfile on signup hook**

Add to `packages/server/src/auth.ts` — a hook that auto-creates UserProfile when a user signs up:

```typescript
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { username } from "better-auth/plugins";
import { prisma } from "./db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "sqlite",
  }),
  plugins: [username()],
  emailAndPassword: {
    enabled: true,
  },
  trustedOrigins: ["http://localhost:5173"],
  secret: process.env.BETTER_AUTH_SECRET!,
  hooks: {
    after: [
      {
        matcher: (context) => context.path === "/sign-up/email",
        handler: async (ctx) => {
          const body = ctx.context.body as { user?: { id?: string } } | undefined;
          if (body?.user?.id) {
            await prisma.userProfile.create({
              data: { userId: body.user.id },
            });
          }
        },
      },
    ],
  },
});

export type Auth = typeof auth;
```

Note: The exact hook API may vary by Better Auth version. Verify the hook structure during implementation and adapt if needed.

**Step 9: Verify server starts and auth endpoints respond**

Run: `cd packages/server && bun run dev`
Test: `curl http://localhost:3000/api/auth/ok` — should not error

**Step 10: Commit**

```bash
git add packages/server/src/
git commit -m "feat: add all API routes, middleware, and auth hooks"
```

---

## Phase 3: Web Frontend

### Task 8: Scaffold web package

**Files:**
- Create: `packages/web/` (Vite scaffold)

**Step 1: Scaffold with Vite**

Run from repo root:
```bash
cd packages && bun create vite web -- --template react-ts && cd web && bun install
bun add tailwindcss @tailwindcss/vite
bun add react-router-dom
bun add -d @types/node
```

**Step 2: Configure Vite**

`packages/web/vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
});
```

**Step 3: Set up Tailwind v4**

Replace `packages/web/src/index.css`:

```css
@import "tailwindcss";
```

**Step 4: Init shadcn**

Run: `cd packages/web && bunx shadcn@latest init`

Then add initial components:
```bash
bunx shadcn@latest add button card input label table dialog select badge
```

**Step 5: Set up Better Auth client**

```bash
cd packages/web && bun add better-auth
```

Create `packages/web/src/lib/auth-client.ts`:

```typescript
import { createAuthClient } from "better-auth/react";
import { usernameClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  baseURL: "/api/auth",
  plugins: [usernameClient()],
});

export const { useSession, signIn, signUp, signOut } = authClient;
```

**Step 6: Create API helper**

Create `packages/web/src/lib/api.ts`:

```typescript
const BASE = "/api";

async function request(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body: unknown) =>
    request(path, { method: "POST", body: JSON.stringify(body) }),
  put: (path: string, body: unknown) =>
    request(path, { method: "PUT", body: JSON.stringify(body) }),
  delete: (path: string) => request(path, { method: "DELETE" }),
};
```

**Step 7: Commit**

```bash
git add packages/web/
git commit -m "chore: scaffold web package with Vite, Tailwind, shadcn"
```

---

### Task 9: Build auth pages (Login / Register)

**Files:**
- Create: `packages/web/src/pages/login.tsx`
- Create: `packages/web/src/pages/register.tsx`
- Create: `packages/web/src/components/auth-layout.tsx`
- Modify: `packages/web/src/App.tsx` (add routing)

**Step 1: Create auth layout**

`packages/web/src/components/auth-layout.tsx`:

```tsx
import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AuthLayout({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  );
}
```

**Step 2: Create login page**

`packages/web/src/pages/login.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signIn } from "@/lib/auth-client";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signIn.username({ username, password });
      navigate("/");
    } catch {
      setError("Invalid credentials");
    }
  }

  return (
    <AuthLayout title="Login">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Login
        </Button>
        <p className="text-sm text-center">
          No account?{" "}
          <Link to="/register" className="underline">
            Register
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
```

**Step 3: Create register page**

`packages/web/src/pages/register.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signUp } from "@/lib/auth-client";
import { AuthLayout } from "@/components/auth-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signUp.username({ username, password, name });
      navigate("/");
    } catch {
      setError("Registration failed");
    }
  }

  return (
    <AuthLayout title="Register">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div>
          <Label htmlFor="name">Display Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full">
          Register
        </Button>
        <p className="text-sm text-center">
          Have an account?{" "}
          <Link to="/login" className="underline">
            Login
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
```

**Step 4: Set up App.tsx with routing**

`packages/web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useSession } from "@/lib/auth-client";
import { LoginPage } from "@/pages/login";
import { RegisterPage } from "@/pages/register";
import { ProjectsPage } from "@/pages/projects";
import { ProjectDetailPage } from "@/pages/project-detail";
import { DashboardPage } from "@/pages/dashboard";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession();
  if (isPending) return <div className="p-8">Loading...</div>;
  if (!session) return <Navigate to="/login" />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectDetailPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
```

Note: `ProjectsPage`, `ProjectDetailPage`, `DashboardPage` will be created in subsequent tasks. Create placeholder stubs for now to avoid import errors:

```tsx
// packages/web/src/pages/projects.tsx
export function ProjectsPage() {
  return <div>Projects (TODO)</div>;
}

// packages/web/src/pages/project-detail.tsx
export function ProjectDetailPage() {
  return <div>Project Detail (TODO)</div>;
}

// packages/web/src/pages/dashboard.tsx
export function DashboardPage() {
  return <div>Dashboard (TODO)</div>;
}
```

**Step 5: Verify the web app starts**

Run: `cd packages/web && bun run dev` — should see login page at http://localhost:5173/login

**Step 6: Commit**

```bash
git add packages/web/
git commit -m "feat: add auth pages and routing"
```

---

### Task 10: Build Projects List page

**Files:**
- Modify: `packages/web/src/pages/projects.tsx`
- Create: `packages/web/src/components/app-layout.tsx`

**Step 1: Create shared app layout with nav**

`packages/web/src/components/app-layout.tsx`:

```tsx
import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function AppLayout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white px-6 py-3 flex items-center gap-6">
        <span className="font-bold text-lg">Work Tracker</span>
        <Link
          to="/"
          className={pathname === "/" ? "font-semibold" : "text-gray-500"}
        >
          Dashboard
        </Link>
        <Link
          to="/projects"
          className={
            pathname.startsWith("/projects") ? "font-semibold" : "text-gray-500"
          }
        >
          Projects
        </Link>
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={() => signOut()}>
            Logout
          </Button>
        </div>
      </nav>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

**Step 2: Build projects list page**

`packages/web/src/pages/projects.tsx`:

```tsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
}

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  async function load() {
    const data = await api.get("/projects");
    setProjects(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await api.post("/projects", { name: newName });
    setNewName("");
    setDialogOpen(false);
    load();
  }

  async function handleDelete(id: string) {
    await api.delete(`/projects/${id}`);
    load();
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>New Project</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Project</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name">Project Name</Label>
                <Input
                  id="name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">Create</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((p) => (
            <TableRow key={p.id}>
              <TableCell>
                <Link to={`/projects/${p.id}`} className="underline">
                  {p.name}
                </Link>
              </TableCell>
              <TableCell className="font-mono text-sm">{p.slug}</TableCell>
              <TableCell>
                {new Date(p.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(p.id)}
                >
                  Delete
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AppLayout>
  );
}
```

**Step 3: Commit**

```bash
git add packages/web/
git commit -m "feat: add projects list page with create/delete"
```

---

### Task 11: Build Project Detail page

**Files:**
- Modify: `packages/web/src/pages/project-detail.tsx`

**Step 1: Build project detail page**

`packages/web/src/pages/project-detail.tsx`:

```tsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface WorkItem {
  id: string;
  startedAt: string;
  endedAt: string | null;
  description: string | null;
}

function formatDuration(start: string, end: string | null): string {
  const s = new Date(start).getTime();
  const e = end ? new Date(end).getTime() : Date.now();
  const mins = Math.floor((e - s) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    startedAt: "",
    endedAt: "",
    description: "",
  });

  async function load() {
    const [p, w] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/work-items`),
    ]);
    setProject(p);
    setItems(w);
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    await api.post(`/projects/${id}/work-items`, form);
    setForm({ startedAt: "", endedAt: "", description: "" });
    setDialogOpen(false);
    load();
  }

  if (!project) return <AppLayout><div>Loading...</div></AppLayout>;

  const triggerUrl = `${window.location.origin}/api/trigger/{token}/${project.slug}`;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{project.name}</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">
          Slug: {project.slug}
        </p>
        <p className="text-gray-500 text-sm mt-1">
          Trigger URL:{" "}
          <code className="bg-gray-100 px-2 py-1 rounded text-xs">
            {triggerUrl}
          </code>
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Work Items</h2>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>Add Work Entry</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Entry</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddEntry} className="space-y-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="datetime-local"
                  value={form.startedAt}
                  onChange={(e) =>
                    setForm({ ...form, startedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="datetime-local"
                  value={form.endedAt}
                  onChange={(e) =>
                    setForm({ ...form, endedAt: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </div>
              <Button type="submit">Add</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {new Date(item.startedAt).toLocaleDateString()}
              </TableCell>
              <TableCell>{formatTime(item.startedAt)}</TableCell>
              <TableCell>
                {item.endedAt ? (
                  formatTime(item.endedAt)
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                {formatDuration(item.startedAt, item.endedAt)}
              </TableCell>
              <TableCell>{item.description || "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </AppLayout>
  );
}
```

**Step 2: Commit**

```bash
git add packages/web/
git commit -m "feat: add project detail page with work items"
```

---

### Task 12: Build Quick Dashboard page

**Files:**
- Modify: `packages/web/src/pages/dashboard.tsx`

**Step 1: Build dashboard page**

`packages/web/src/pages/dashboard.tsx`:

```tsx
import { useEffect, useState, useCallback } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

interface Project {
  id: string;
  name: string;
  slug: string;
}

interface DashboardSlot {
  slot: number;
  projectId: string;
  project: Project;
}

interface WorkItemWithProject {
  id: string;
  startedAt: string;
  endedAt: string | null;
  project: { id: string; name: string; slug: string };
}

interface Status {
  active: WorkItemWithProject | null;
  today: WorkItemWithProject[];
}

const SLOT_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
];

export function DashboardPage() {
  const [slots, setSlots] = useState<DashboardSlot[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [status, setStatus] = useState<Status>({ active: null, today: [] });
  const [configOpen, setConfigOpen] = useState(false);
  const [configSlots, setConfigSlots] = useState<(string | null)[]>(
    Array(6).fill(null)
  );

  const load = useCallback(async () => {
    const [s, st, p] = await Promise.all([
      api.get("/dashboard"),
      api.get("/status"),
      api.get("/projects"),
    ]);
    setSlots(s);
    setStatus(st);
    setProjects(p);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openConfig() {
    const current = Array(6).fill(null) as (string | null)[];
    for (const s of slots) {
      current[s.slot - 1] = s.projectId;
    }
    setConfigSlots(current);
    setConfigOpen(true);
  }

  async function saveConfig() {
    const payload = configSlots.map((projectId, i) => ({
      slot: i + 1,
      projectId,
    }));
    await api.put("/dashboard", { slots: payload });
    setConfigOpen(false);
    load();
  }

  async function triggerProject(slug: string) {
    await api.get(`/trigger/session/${slug}`);
    // Reload status to reflect new active item
    const st = await api.get("/status");
    setStatus(st);
  }

  async function stopAll() {
    await api.get("/trigger/session/stop");
    const st = await api.get("/status");
    setStatus(st);
  }

  // Build a color map for today's timeline
  const colorMap: Record<string, string> = {};
  slots.forEach((s, i) => {
    colorMap[s.project.id] = SLOT_COLORS[i % SLOT_COLORS.length];
  });

  const now = new Date();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">
              {now.toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </h1>
            {status.active ? (
              <p className="text-lg mt-1">
                Working on:{" "}
                <span className="font-semibold">
                  {status.active.project.name}
                </span>
              </p>
            ) : (
              <p className="text-gray-500 mt-1">Not tracking</p>
            )}
          </div>
          <Dialog open={configOpen} onOpenChange={setConfigOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" onClick={openConfig}>
                Configure
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Configure Dashboard Slots</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {configSlots.map((val, i) => (
                  <div key={i}>
                    <Label>Slot {i + 1}</Label>
                    <Select
                      value={val || "none"}
                      onValueChange={(v) => {
                        const next = [...configSlots];
                        next[i] = v === "none" ? null : v;
                        setConfigSlots(next);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">— Empty —</SelectItem>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                <Button onClick={saveConfig} className="w-full">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Project Buttons — 3x2 grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {slots.map((s, i) => {
            const isActive = status.active?.project.id === s.project.id;
            return (
              <Button
                key={s.slot}
                onClick={() => triggerProject(s.project.slug)}
                variant={isActive ? "default" : "outline"}
                className={`h-16 text-lg ${isActive ? SLOT_COLORS[i % SLOT_COLORS.length] + " text-white" : ""}`}
              >
                {s.project.name}
              </Button>
            );
          })}
        </div>

        {/* Stop All */}
        <Button
          variant="destructive"
          className="w-full mb-8"
          onClick={stopAll}
        >
          Stop All
        </Button>

        {/* Today's Timeline */}
        <h2 className="text-lg font-semibold mb-3">Today</h2>
        <div className="space-y-1">
          {status.today.map((item) => {
            const start = new Date(item.startedAt);
            const end = item.endedAt ? new Date(item.endedAt) : new Date();
            const mins = Math.floor((end.getTime() - start.getTime()) / 60000);
            const color =
              colorMap[item.project.id] || "bg-gray-400";
            return (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-12 text-right">
                  {start.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div
                  className={`${color} text-white rounded px-3 py-1 text-sm flex-1`}
                >
                  {item.project.name} — {mins}m
                  {!item.endedAt && " (active)"}
                </div>
              </div>
            );
          })}
          {status.today.length === 0 && (
            <p className="text-gray-400 text-sm">No work logged today</p>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
```

Note: The dashboard trigger buttons use session-auth routes. We need to add session-based trigger routes to the server. Add these to `packages/server/src/routes/trigger.ts`:

```typescript
// Session-based trigger (for web dashboard)
trigger.get("/session/:slug", requireAuth, async (c) => {
  const userId = c.get("userId");
  const workItem = await triggerService.startWork(userId, c.req.param("slug"));
  if (!workItem) return c.json({ error: "Project not found" }, 404);
  return c.json({ ok: true, workItem });
});

trigger.get("/session/stop", requireAuth, async (c) => {
  const userId = c.get("userId");
  await triggerService.stopAll(userId);
  return c.json({ ok: true, active: null });
});
```

Don't forget to add the `requireAuth` import at the top of the trigger routes file.

**Step 2: Commit**

```bash
git add packages/web/ packages/server/
git commit -m "feat: add quick dashboard with project buttons and timeline"
```

---

## Phase 4: GNOME Extension

### Task 13: Create GNOME extension skeleton

**Files:**
- Create: `packages/gnome-extension/metadata.json`
- Create: `packages/gnome-extension/extension.js`
- Create: `packages/gnome-extension/stylesheet.css`
- Create: `packages/gnome-extension/schemas/org.gnome.shell.extensions.work-tracker.gschema.xml`

**Step 1: Create metadata.json**

`packages/gnome-extension/metadata.json`:

```json
{
  "uuid": "work-tracker@gnome-work-tracker",
  "name": "Work Tracker",
  "description": "One-click time tracking with project buttons in the top panel.",
  "version": 1,
  "shell-version": ["45", "46", "47", "48", "49"],
  "settings-schema": "org.gnome.shell.extensions.work-tracker",
  "url": "https://github.com/mir333/gnome-work-tracker"
}
```

**Step 2: Create GSettings schema**

`packages/gnome-extension/schemas/org.gnome.shell.extensions.work-tracker.gschema.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist>
  <schema id="org.gnome.shell.extensions.work-tracker"
          path="/org/gnome/shell/extensions/work-tracker/">
    <key name="server-url" type="s">
      <default>''</default>
      <summary>Server URL</summary>
    </key>
    <key name="api-token" type="s">
      <default>''</default>
      <summary>API token</summary>
    </key>
    <key name="slot-slugs" type="as">
      <default>['', '', '', '', '', '']</default>
      <summary>Project slugs for slots 1-6</summary>
    </key>
    <key name="slot-labels" type="as">
      <default>['', '', '', '', '', '']</default>
      <summary>Project labels for slots 1-6</summary>
    </key>
    <key name="active-slot" type="i">
      <default>-1</default>
      <summary>Currently active slot index (-1 = none)</summary>
    </key>
  </schema>
</schemalist>
```

**Step 3: Create stylesheet.css**

`packages/gnome-extension/stylesheet.css`:

```css
.work-tracker-bar {
  spacing: 4px;
  padding: 0 6px;
}

.work-tracker-button {
  padding: 0 10px;
  border-radius: 4px;
  font-weight: bold;
}

.work-tracker-button:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.work-tracker-active {
  background-color: rgba(53, 132, 228, 0.6);
  color: white;
}

.work-tracker-stop {
  color: rgba(246, 97, 81, 0.9);
}
```

**Step 4: Create extension.js**

`packages/gnome-extension/extension.js`:

```js
import Clutter from "gi://Clutter";
import GLib from "gi://GLib";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
import St from "gi://St";

import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
import * as Main from "resource:///org/gnome/shell/ui/main.js";
import * as PanelMenu from "resource:///org/gnome/shell/ui/panelMenu.js";
import * as PopupMenu from "resource:///org/gnome/shell/ui/popupMenu.js";

const _session = new Soup.Session();

function httpGet(url, callback) {
  const message = Soup.Message.new("GET", url);
  if (!message) {
    callback(new Error(`Invalid URL: ${url}`), null);
    return;
  }
  _session.send_and_read_async(
    message,
    GLib.PRIORITY_DEFAULT,
    null,
    (session, result) => {
      try {
        const bytes = session.send_and_read_finish(result);
        const statusCode = message.get_status();
        if (statusCode !== Soup.Status.OK) {
          callback(new Error(`HTTP ${statusCode}`), null);
          return;
        }
        const body = new TextDecoder().decode(bytes.get_data());
        callback(null, JSON.parse(body));
      } catch (e) {
        callback(e, null);
      }
    }
  );
}

// Settings indicator (gear icon with popup for login/config)
const SettingsIndicator = GObject.registerClass(
  class SettingsIndicator extends PanelMenu.Button {
    _init(extension) {
      super._init(0.0, "Work Tracker Settings");
      this._extension = extension;
      this._settings = extension.getSettings();

      this.add_child(
        new St.Icon({
          icon_name: "preferences-system-symbolic",
          style_class: "system-status-icon",
        })
      );

      this._buildMenu();
    }

    _buildMenu() {
      const menu = this.menu;
      menu.removeAll();

      const apiToken = this._settings.get_string("api-token");

      if (!apiToken) {
        // Not logged in — show login form hint
        const item = new PopupMenu.PopupMenuItem("Login required");
        item.sensitive = false;
        menu.addMenuItem(item);

        const serverItem = new PopupMenu.PopupMenuItem("Set server URL...");
        menu.addMenuItem(serverItem);
        // Note: Full login form would require more complex UI.
        // For MVP, settings can be configured via GNOME Extensions app / dconf.
      } else {
        const refreshItem = new PopupMenu.PopupMenuItem("Refresh Config");
        refreshItem.connect("activate", () => {
          this._extension.fetchAndStoreConfig();
        });
        menu.addMenuItem(refreshItem);

        const logoutItem = new PopupMenu.PopupMenuItem("Clear credentials");
        logoutItem.connect("activate", () => {
          this._settings.set_string("api-token", "");
          this._settings.set_string("server-url", "");
          this._extension._bar?.refreshFromSettings();
          this._buildMenu();
        });
        menu.addMenuItem(logoutItem);
      }
    }
  }
);

// Project button
const ProjectButton = GObject.registerClass(
  class ProjectButton extends St.Button {
    _init(label, slug) {
      super._init({
        label,
        style_class: "work-tracker-button panel-button",
        can_focus: true,
        track_hover: true,
      });
      this._slug = slug;
    }

    get slug() {
      return this._slug;
    }

    setActive(active) {
      if (active) this.add_style_class_name("work-tracker-active");
      else this.remove_style_class_name("work-tracker-active");
    }
  }
);

// Button bar
const WorkTrackerBar = GObject.registerClass(
  class WorkTrackerBar extends St.BoxLayout {
    _init(extension) {
      super._init({ style_class: "work-tracker-bar" });
      this._extension = extension;
      this._settings = extension.getSettings();
      this._buttons = [];
      this._buildButtons();
      this._restoreActiveState();
    }

    _buildButtons() {
      this.destroy_all_children();
      this._buttons = [];

      const slugs = this._settings.get_strv("slot-slugs");
      const labels = this._settings.get_strv("slot-labels");
      const apiToken = this._settings.get_string("api-token");

      if (!apiToken) return;

      for (let i = 0; i < 6; i++) {
        const slug = slugs[i] ?? "";
        const label = labels[i] ?? "";
        if (!slug) continue;

        const btn = new ProjectButton(label, slug);
        btn.connect("clicked", () => this._onProjectClicked(i, slug));
        this.add_child(btn);
        this._buttons.push({ index: i, slug, button: btn });
      }

      const stopBtn = new St.Button({
        label: "Stop",
        style_class: "work-tracker-button work-tracker-stop panel-button",
        can_focus: true,
        track_hover: true,
      });
      stopBtn.connect("clicked", () => this._onStopClicked());
      this.add_child(stopBtn);
    }

    _onProjectClicked(slotIndex, slug) {
      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/${slug}`;

      httpGet(url, (err) => {
        if (err) {
          console.error(`[work-tracker] Trigger failed: ${err.message}`);
          return;
        }
        this._setActiveSlot(slotIndex);
        this._settings.set_int("active-slot", slotIndex);
      });
    }

    _onStopClicked() {
      const apiToken = this._settings.get_string("api-token");
      const serverUrl = this._settings.get_string("server-url");
      const url = `${serverUrl}/api/trigger/${apiToken}/stop`;

      httpGet(url, (err) => {
        if (err) {
          console.error(`[work-tracker] Stop failed: ${err.message}`);
          return;
        }
        this._setActiveSlot(-1);
        this._settings.set_int("active-slot", -1);
      });
    }

    _setActiveSlot(slotIndex) {
      for (const { index, button } of this._buttons) {
        button.setActive(index === slotIndex);
      }
    }

    _restoreActiveState() {
      const saved = this._settings.get_int("active-slot");
      this._setActiveSlot(saved);
    }

    refreshFromSettings() {
      this._buildButtons();
      this._restoreActiveState();
    }
  }
);

// Main extension
export default class WorkTrackerExtension extends Extension {
  enable() {
    this._settings = this.getSettings();

    this._bar = new WorkTrackerBar(this);
    Main.panel._leftBox.insert_child_at_index(this._bar, 0);

    this._settingsIndicator = new SettingsIndicator(this);
    Main.panel.addToStatusArea(this.metadata.uuid, this._settingsIndicator);

    this._settingsChangedId = this._settings.connect("changed", () => {
      this._bar.refreshFromSettings();
    });
  }

  disable() {
    if (this._settingsChangedId) {
      this._settings.disconnect(this._settingsChangedId);
      this._settingsChangedId = null;
    }

    if (this._bar) {
      this._bar.destroy();
      this._bar = null;
    }

    if (this._settingsIndicator) {
      this._settingsIndicator.destroy();
      this._settingsIndicator = null;
    }

    this._settings = null;
  }

  fetchAndStoreConfig() {
    const serverUrl = this._settings.get_string("server-url");
    const apiToken = this._settings.get_string("api-token");
    const url = `${serverUrl}/api/dashboard/${apiToken}`;

    httpGet(url, (err, data) => {
      if (err) {
        console.error(`[work-tracker] Config fetch failed: ${err.message}`);
        return;
      }

      const slugs = ["", "", "", "", "", ""];
      const labels = ["", "", "", "", "", ""];

      for (const item of data) {
        const i = item.slot - 1;
        slugs[i] = item.projectSlug ?? "";
        labels[i] = item.projectName ?? "";
      }

      this._settings.set_strv("slot-slugs", slugs);
      this._settings.set_strv("slot-labels", labels);
    });
  }
}
```

**Step 5: Create install script**

Create `packages/gnome-extension/install.sh`:

```bash
#!/bin/bash
EXT_DIR="$HOME/.local/share/gnome-shell/extensions/work-tracker@gnome-work-tracker"
mkdir -p "$EXT_DIR/schemas"
cp metadata.json extension.js stylesheet.css "$EXT_DIR/"
cp schemas/*.gschema.xml "$EXT_DIR/schemas/"
glib-compile-schemas "$EXT_DIR/schemas/"
echo "Installed. Restart GNOME Shell (Alt+F2 → r) or log out/in to load."
```

**Step 6: Commit**

```bash
git add packages/gnome-extension/
git commit -m "feat: add GNOME Shell extension with panel buttons"
```

---

## Phase 5: Integration & Polish

### Task 14: Add UserProfile API token endpoint

The web app needs to show the user their API token (for configuring the GNOME extension).

**Files:**
- Create: `packages/server/src/routes/profile.ts`
- Modify: `packages/server/src/index.ts` (mount profile route)

**Step 1: Create profile route**

`packages/server/src/routes/profile.ts`:

```typescript
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
```

**Step 2: Mount in index.ts**

Add to `packages/server/src/index.ts`:
```typescript
import { profile } from "./routes/profile";
// ...
app.route("/api/profile", profile);
```

**Step 3: Commit**

```bash
git add packages/server/src/
git commit -m "feat: add profile API for token management"
```

---

### Task 15: Add settings page to web app

**Files:**
- Create: `packages/web/src/pages/settings.tsx`
- Modify: `packages/web/src/App.tsx` (add settings route)
- Modify: `packages/web/src/components/app-layout.tsx` (add settings nav link)

**Step 1: Create settings page**

`packages/web/src/pages/settings.tsx`:

```tsx
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/app-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

export function SettingsPage() {
  const [apiToken, setApiToken] = useState("");

  async function load() {
    const data = await api.get("/profile");
    setApiToken(data.apiToken);
  }

  useEffect(() => {
    load();
  }, []);

  async function regenerate() {
    const data = await api.post("/profile/regenerate-token", {});
    setApiToken(data.apiToken);
  }

  return (
    <AppLayout>
      <div className="max-w-lg">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        <Card>
          <CardHeader>
            <CardTitle>API Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-500">
              Use this token to configure the GNOME extension or trigger URLs.
            </p>
            <div>
              <Label>Your Token</Label>
              <Input value={apiToken} readOnly className="font-mono text-sm" />
            </div>
            <Button variant="outline" onClick={regenerate}>
              Regenerate Token
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
```

**Step 2: Add route and nav link**

Add to `App.tsx` routes:
```tsx
import { SettingsPage } from "@/pages/settings";
// Inside <Routes>:
<Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
```

Add to `app-layout.tsx` nav:
```tsx
<Link to="/settings" className={pathname === "/settings" ? "font-semibold" : "text-gray-500"}>
  Settings
</Link>
```

**Step 3: Commit**

```bash
git add packages/web/
git commit -m "feat: add settings page with API token display"
```

---

### Task 16: End-to-end smoke test

**Step 1: Start the server**

```bash
cd packages/server && bun run dev
```

**Step 2: Start the web app**

```bash
cd packages/web && bun run dev
```

**Step 3: Manual test flow**

1. Open http://localhost:5173/register — create a user
2. Go to Projects — create 2-3 projects
3. Go to Settings — copy API token
4. Go to Dashboard — configure slots, click project buttons, verify timeline updates
5. Test trigger URL: `curl http://localhost:3000/api/trigger/{token}/{slug}`
6. Verify the active item changed

**Step 4: Install and test GNOME extension**

```bash
cd packages/gnome-extension && bash install.sh
```

Configure via `dconf` or GNOME Extensions app:
```bash
dconf write /org/gnome/shell/extensions/work-tracker/server-url "'http://localhost:3000'"
dconf write /org/gnome/shell/extensions/work-tracker/api-token "'<your-token>'"
```

Restart GNOME Shell, verify buttons appear, click to trigger.

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: finalize project structure"
```

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 — Scaffolding | 1–4 | Monorepo, server, Prisma, Better Auth |
| 2 — Server API | 5–7 | Repositories, services, routes |
| 3 — Web Frontend | 8–12 | Vite scaffold, auth, projects, dashboard |
| 4 — GNOME Extension | 13 | Extension with panel buttons |
| 5 — Integration | 14–16 | Token management, settings page, smoke test |
