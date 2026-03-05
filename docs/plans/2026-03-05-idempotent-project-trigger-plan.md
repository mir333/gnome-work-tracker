# Idempotent Project Trigger — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent duplicate work items when the same project is triggered while already active.

**Architecture:** Add an early-return guard in `triggerService.startWork()` that checks if the active work item already belongs to the requested project. If so, return the existing item with no DB writes. No changes to routes, repository, or frontend.

**Tech Stack:** TypeScript, Hono, Prisma, Bun (test runner)

---

### Task 1: Write the failing test for idempotent trigger

**Files:**
- Create: `packages/server/src/services/trigger.service.test.ts`

**Step 1: Write the test file**

Create a test that mocks the repositories and verifies that calling `startWork` for an already-active project returns the existing work item without creating a new one or closing the old one.

```typescript
import { describe, test, expect, mock, beforeEach } from "bun:test";

// We need to mock the repository modules before importing the service.
// Bun uses module-level mocking.

const mockFindBySlug = mock(() => Promise.resolve(null));
const mockFindActiveByUser = mock(() => Promise.resolve(null));
const mockCreate = mock(() => Promise.resolve(null));
const mockUpdate = mock(() => Promise.resolve(null));
const mockDelete = mock(() => Promise.resolve(null));
const mockFindByApiToken = mock(() => Promise.resolve(null));

mock.module("../repositories/project.repository", () => ({
  projectRepository: {
    findBySlug: mockFindBySlug,
  },
}));

mock.module("../repositories/work-item.repository", () => ({
  workItemRepository: {
    findActiveByUser: mockFindActiveByUser,
    create: mockCreate,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

mock.module("../repositories/user-profile.repository", () => ({
  userProfileRepository: {
    findByApiToken: mockFindByApiToken,
  },
}));

// Import AFTER mocking
const { triggerService } = await import("./trigger.service");

const USER_ID = "user-1";
const PROJECT_ID = "proj-1";
const SLUG = "my-project";

beforeEach(() => {
  mockFindBySlug.mockReset();
  mockFindActiveByUser.mockReset();
  mockCreate.mockReset();
  mockUpdate.mockReset();
  mockDelete.mockReset();
});

describe("triggerService.startWork", () => {
  test("returns existing work item when same project is already active", async () => {
    const existingWorkItem = {
      id: "wi-1",
      projectId: PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date(Date.now() - 60_000), // started 1 min ago
      endedAt: null,
      project: { id: PROJECT_ID, slug: SLUG, name: "My Project", userId: USER_ID },
    };

    mockFindBySlug.mockResolvedValue({
      id: PROJECT_ID,
      slug: SLUG,
      name: "My Project",
      userId: USER_ID,
    });
    mockFindActiveByUser.mockResolvedValue(existingWorkItem);

    const result = await triggerService.startWork(USER_ID, SLUG);

    // Should return the existing work item
    expect(result).toEqual(existingWorkItem);

    // Should NOT create a new work item
    expect(mockCreate).not.toHaveBeenCalled();

    // Should NOT close/update/delete the existing one
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("closes active work item and creates new one when switching projects", async () => {
    const OTHER_PROJECT_ID = "proj-2";

    const activeWorkItem = {
      id: "wi-old",
      projectId: OTHER_PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date(Date.now() - 120_000), // started 2 min ago
      endedAt: null,
      project: { id: OTHER_PROJECT_ID, slug: "other", name: "Other", userId: USER_ID },
    };

    const newWorkItem = {
      id: "wi-new",
      projectId: PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date(),
      endedAt: null,
    };

    mockFindBySlug.mockResolvedValue({
      id: PROJECT_ID,
      slug: SLUG,
      name: "My Project",
      userId: USER_ID,
    });
    mockFindActiveByUser.mockResolvedValue(activeWorkItem);
    mockCreate.mockResolvedValue(newWorkItem);

    const result = await triggerService.startWork(USER_ID, SLUG);

    // Should close the old work item
    expect(mockUpdate).toHaveBeenCalledTimes(1);

    // Should create a new work item
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(newWorkItem);
  });

  test("creates new work item when no active work item exists", async () => {
    const newWorkItem = {
      id: "wi-new",
      projectId: PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date(),
      endedAt: null,
    };

    mockFindBySlug.mockResolvedValue({
      id: PROJECT_ID,
      slug: SLUG,
      name: "My Project",
      userId: USER_ID,
    });
    mockFindActiveByUser.mockResolvedValue(null);
    mockCreate.mockResolvedValue(newWorkItem);

    const result = await triggerService.startWork(USER_ID, SLUG);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual(newWorkItem);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  test("returns null for non-existent project", async () => {
    mockFindBySlug.mockResolvedValue(null);

    const result = await triggerService.startWork(USER_ID, "nonexistent");

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && bun test src/services/trigger.service.test.ts`

Expected: The first test ("returns existing work item when same project is already active") FAILS because the current code closes the active item and creates a new one instead of returning it.

**Step 3: Commit the failing test**

```bash
git add packages/server/src/services/trigger.service.test.ts
git commit -m "test: add tests for idempotent project trigger (failing)"
```

---

### Task 2: Implement the idempotent guard

**Files:**
- Modify: `packages/server/src/services/trigger.service.ts:14-16`

**Step 1: Add the early-return check**

In `trigger.service.ts`, after finding the active work item (line 15), add a check: if the active item's `projectId` matches the requested project's `id`, return the active item immediately.

Replace lines 14-16:

```typescript
    // Close any active work item
    const active = await workItemRepository.findActiveByUser(userId);
    if (active) {
```

With:

```typescript
    // If already working on this project, return existing work item (idempotent)
    const active = await workItemRepository.findActiveByUser(userId);
    if (active && active.projectId === project.id) {
      return active;
    }

    // Close any active work item (different project)
    if (active) {
```

The full method after the change:

```typescript
  async startWork(userId: string, slug: string) {
    const project = await projectRepository.findBySlug(slug);
    if (!project || project.userId !== userId) return null;

    // If already working on this project, return existing work item (idempotent)
    const active = await workItemRepository.findActiveByUser(userId);
    if (active && active.projectId === project.id) {
      return active;
    }

    // Close any active work item (different project)
    if (active) {
      const now = new Date();
      const durationSecs =
        (now.getTime() - new Date(active.startedAt).getTime()) / 1000;

      if (durationSecs < 30) {
        // Auto-delete entries shorter than 30 seconds
        await workItemRepository.delete(active.id);
      } else {
        await workItemRepository.update(active.id, { endedAt: now });
      }
    }

    // Start new work item
    return workItemRepository.create({
      projectId: project.id,
      userId,
      startedAt: new Date(),
    });
  },
```

**Step 2: Run the tests to verify they pass**

Run: `cd /workspace/miro/gnome-work-tracker/packages/server && bun test src/services/trigger.service.test.ts`

Expected: All 4 tests PASS.

**Step 3: Commit**

```bash
git add packages/server/src/services/trigger.service.ts
git commit -m "feat: make project trigger idempotent for already-active projects"
```

---

### Task 3: Manual smoke test

**Step 1: Start the server**

Run: `cd /workspace/miro/gnome-work-tracker && bun run dev` (or whatever the dev command is — check `package.json`)

**Step 2: Verify via curl or browser**

1. Trigger a project: `GET /api/trigger/session/<slug>` — should create a work item
2. Trigger the same project again: `GET /api/trigger/session/<slug>` — should return the same work item (same `id`, same `startedAt`)
3. Trigger a different project: should close the first, create a new one
4. Stop all: `GET /api/trigger/session/stop` — should close active item

**Step 3: Final commit if any adjustments needed**
