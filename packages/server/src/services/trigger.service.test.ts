import { describe, test, expect, mock, beforeEach } from "bun:test";

// We need to mock the repository modules before importing the service.
// Bun uses module-level mocking.

const mockFindBySlug = mock(() => Promise.resolve(null));
const mockFindActiveByUser = mock(() => Promise.resolve(null));
const mockCreate = mock(() => Promise.resolve(null));
const mockUpdate = mock(() => Promise.resolve(null));
const mockDelete = mock(() => Promise.resolve(null));
const mockFindByApiToken = mock(() => Promise.resolve(null));
const mockFindById = mock(() => Promise.resolve(null));

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
    findById: mockFindById,
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
  mockFindById.mockReset();
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

describe("triggerService.updateWorkItem", () => {
  test("updates startedAt for a work item owned by the user", async () => {
    const workItem = {
      id: "wi-1",
      projectId: PROJECT_ID,
      userId: USER_ID,
      startedAt: new Date("2026-03-05T10:00:00"),
      endedAt: null,
    };

    mockFindById.mockResolvedValue(workItem);
    mockUpdate.mockResolvedValue({
      ...workItem,
      startedAt: new Date("2026-03-05T09:30:00"),
    });

    const result = await triggerService.updateWorkItem(USER_ID, "wi-1", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
    expect(result!.startedAt).toEqual(new Date("2026-03-05T09:30:00"));
  });

  test("returns null when work item does not belong to user", async () => {
    mockFindById.mockResolvedValue({
      id: "wi-1",
      projectId: PROJECT_ID,
      userId: "other-user",
      startedAt: new Date(),
      endedAt: null,
    });

    const result = await triggerService.updateWorkItem(USER_ID, "wi-1", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  test("returns null when work item not found", async () => {
    mockFindById.mockResolvedValue(null);

    const result = await triggerService.updateWorkItem(USER_ID, "nonexistent", {
      startedAt: "2026-03-05T09:30:00",
    });

    expect(result).toBeNull();
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
