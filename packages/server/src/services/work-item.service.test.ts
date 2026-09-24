import { describe, test, expect, mock, beforeEach } from "bun:test";

// Mock EVERY method the trigger and work-item services use (bun mocks are process-wide).
const mockFindById = mock(async (_id: string) => null as any);
const mockFindBySlug = mock(async (_slug: string) => null as any);
const mockCreate = mock(async (data: any) => ({ id: "wi-new", ...data }));
const mockFindOverlapping = mock(async () => null as any);

mock.module("../repositories/project.repository", () => ({
  projectRepository: { findById: mockFindById, findBySlug: mockFindBySlug },
}));
mock.module("../repositories/work-item.repository", () => ({
  workItemRepository: {
    create: mockCreate,
    findOverlapping: mockFindOverlapping,
    findActiveByUser: mock(async () => null),
    findById: mock(async () => null),
    update: mock(async () => null),
    delete: mock(async () => null),
  },
}));
mock.module("./audit-log.service", () => ({
  auditLogService: { log: mock(() => {}) },
  AuditAction: new Proxy({}, { get: (_t, k) => String(k) }),
  EntityType: new Proxy({}, { get: (_t, k) => String(k) }),
}));

const { workItemService } = await import("./work-item.service");

const USER_ID = "user-1";
const PROJECT = { id: "proj-1", userId: USER_ID, slug: "p", name: "P" };
const START = "2026-09-24T08:00:00.000Z";
const END = "2026-09-24T09:00:00.000Z";

beforeEach(() => {
  mockFindById.mockReset();
  mockCreate.mockClear();
  mockFindOverlapping.mockReset();
  mockFindOverlapping.mockResolvedValue(null);
});

describe("workItemService.createManual location capture", () => {
  test("stores the capture with locationSource manual", async () => {
    mockFindById.mockResolvedValue(PROJECT);
    const capture = mock(async () => ({
      ipAddress: "203.0.113.5", location: "Prague, Czechia", locationSource: "manual" as const,
    }));

    await workItemService.createManual(PROJECT.id, USER_ID, START, END, "note", capture);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toMatchObject({
      ipAddress: "203.0.113.5",
      location: "Prague, Czechia",
      locationSource: "manual",
    });
  });

  test("does not capture when the project is not the caller's", async () => {
    mockFindById.mockResolvedValue({ ...PROJECT, userId: "someone-else" });
    const capture = mock(async () => ({ ipAddress: "1.1.1.1", location: null, locationSource: "manual" as const }));

    expect(await workItemService.createManual(PROJECT.id, USER_ID, START, END, undefined, capture)).toBeNull();
    expect(capture).not.toHaveBeenCalled();
  });

  test("does not capture when validation fails", async () => {
    mockFindById.mockResolvedValue(PROJECT);
    const capture = mock(async () => ({ ipAddress: "1.1.1.1", location: null, locationSource: "manual" as const }));

    await expect(workItemService.createManual(PROJECT.id, USER_ID, END, START, undefined, capture)).rejects.toThrow();
    expect(capture).not.toHaveBeenCalled();
  });
});
