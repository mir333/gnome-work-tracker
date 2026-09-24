import { describe, test, expect, mock, beforeEach } from "bun:test";

// Bun's mock.module is PROCESS-WIDE: this file's mock of work-item.repository
// must include every method that trigger.service / work-item.service also
// call, since whichever mock.module call "wins" for this path is used by
// every service that imports it for the rest of the test run (regardless of
// file order).
const mockCreate = mock(async (_data: any) => null as any);
const mockFindOverlapping = mock(async (..._args: any[]) => null as any);
const mockFindActiveByUser = mock(async (_userId: string) => null as any);
const mockFindById = mock(async (_id: string) => null as any);
const mockUpdate = mock(async (_id: string, _data: any) => null as any);
const mockDelete = mock(async (_id: string) => null as any);
const mockFindByUserAndDateRange = mock(
  async (_userId: string, _from: Date, _to: Date, _opts?: { includeLocation?: boolean }) =>
    [] as any[]
);
const mockFindByProject = mock(async (..._args: any[]) => [] as any[]);
const mockFindTodayByUser = mock(async (_userId: string) => [] as any[]);

mock.module("../repositories/work-item.repository", () => ({
  workItemRepository: {
    create: mockCreate,
    findOverlapping: mockFindOverlapping,
    findActiveByUser: mockFindActiveByUser,
    findById: mockFindById,
    update: mockUpdate,
    delete: mockDelete,
    findByUserAndDateRange: mockFindByUserAndDateRange,
    findByProject: mockFindByProject,
    findTodayByUser: mockFindTodayByUser,
  },
}));

// organisation.service imports these directly; mock every one that touches the DB.
const mockOrgFindById = mock(async (_id: string) => null as any);
mock.module("../repositories/organisation.repository", () => ({
  organisationRepository: {
    create: mock(async (_data: any) => null as any),
    findById: mockOrgFindById,
    findByUser: mock(async (_userId: string) => [] as any[]),
    update: mock(async (_id: string, _data: any) => null as any),
    delete: mock(async (_id: string) => {}),
  },
}));

const mockFindByOrgAndUser = mock(async (_orgId: string, _userId: string) => null as any);
mock.module("../repositories/organisation-member.repository", () => ({
  organisationMemberRepository: {
    create: mock(async (_data: any) => null as any),
    findByOrgAndUser: mockFindByOrgAndUser,
    findAllByOrg: mock(async (_orgId: string) => [] as any[]),
    updateRole: mock(async (_orgId: string, _userId: string, _role: string) => null as any),
    delete: mock(async (_orgId: string, _userId: string) => {}),
  },
}));

mock.module("../repositories/organisation-invite.repository", () => ({
  organisationInviteRepository: {
    create: mock(async (_data: any) => null as any),
    findById: mock(async (_id: string) => null as any),
    findByOrgAndUser: mock(async (_orgId: string, _userId: string) => null as any),
    findPendingByOrg: mock(async (_orgId: string) => [] as any[]),
    findPendingByUserId: mock(async (_userId: string) => [] as any[]),
    updateStatus: mock(async (_id: string, _status: string) => null as any),
    delete: mock(async (_id: string) => {}),
  },
}));

mock.module("../repositories/project.repository", () => ({
  projectRepository: {
    findAllByUser: mock(async (_userId: string) => [] as any[]),
    findById: mock(async (_id: string) => null as any),
    findBySlug: mock(async (_slug: string) => null as any),
    create: mock(async (_data: any) => null as any),
    update: mock(async (_id: string, _data: any) => null as any),
    delete: mock(async (_id: string) => {}),
  },
}));

mock.module("./timesheet.service", () => ({
  timesheetService: {
    getTimesheet: mock(async (_userId: string, _from: string, _to: string) => ({
      totalEffectiveMinutes: 0,
      manDays: 0,
    })),
  },
}));

mock.module("../db", () => ({
  prisma: {
    user: { findFirst: mock(async () => null) },
  },
  SHOW_LOCATION: { ipAddress: false, location: false, locationSource: false },
  HIDE_LOCATION: { ipAddress: true, location: true, locationSource: true },
}));

// Import AFTER mocking
const { organisationService } = await import("./organisation.service");

const ORG_ID = "org-1";
const VIEWER_ID = "viewer-1";
const MEMBER_ID = "member-1";
const FROM = "2026-01-01T00:00:00.000Z";
const TO = "2026-01-31T00:00:00.000Z";

beforeEach(() => {
  mockFindByOrgAndUser.mockReset();
  mockFindByUserAndDateRange.mockReset();
  mockFindByUserAndDateRange.mockResolvedValue([]);
});

function allowViewerSeesMember(role: "owner" | "manager") {
  mockFindByOrgAndUser.mockImplementation(async (orgId: string, userId: string) => {
    if (orgId !== ORG_ID) return null;
    if (userId === VIEWER_ID) return { orgId, userId, role };
    if (userId === MEMBER_ID) return { orgId, userId, role: "member" };
    return null;
  });
}

describe("organisationService.getMemberWorkItems", () => {
  test("forwards { includeLocation: true } to the repository as the 4th argument", async () => {
    allowViewerSeesMember("manager");

    await organisationService.getMemberWorkItems(ORG_ID, VIEWER_ID, MEMBER_ID, FROM, TO, {
      includeLocation: true,
    });

    expect(mockFindByUserAndDateRange).toHaveBeenCalledTimes(1);
    expect(mockFindByUserAndDateRange.mock.calls[0][3]).toEqual({ includeLocation: true });
  });

  test("forwards { includeLocation: false } to the repository as the 4th argument", async () => {
    allowViewerSeesMember("owner");

    await organisationService.getMemberWorkItems(ORG_ID, VIEWER_ID, MEMBER_ID, FROM, TO, {
      includeLocation: false,
    });

    expect(mockFindByUserAndDateRange).toHaveBeenCalledTimes(1);
    expect(mockFindByUserAndDateRange.mock.calls[0][3]).toEqual({ includeLocation: false });
  });

  test("forwards the default {} when no opts are passed", async () => {
    allowViewerSeesMember("manager");

    await organisationService.getMemberWorkItems(ORG_ID, VIEWER_ID, MEMBER_ID, FROM, TO);

    expect(mockFindByUserAndDateRange).toHaveBeenCalledTimes(1);
    expect(mockFindByUserAndDateRange.mock.calls[0][3]).toEqual({});
  });

  test("returns null and does not call the repository when the viewer can't view member data", async () => {
    mockFindByOrgAndUser.mockImplementation(async (orgId: string, userId: string) => {
      if (orgId !== ORG_ID) return null;
      if (userId === VIEWER_ID) return { orgId, userId, role: "member" };
      if (userId === MEMBER_ID) return { orgId, userId, role: "member" };
      return null;
    });

    const result = await organisationService.getMemberWorkItems(
      ORG_ID,
      VIEWER_ID,
      MEMBER_ID,
      FROM,
      TO,
      { includeLocation: true }
    );

    expect(result).toBeNull();
    expect(mockFindByUserAndDateRange).not.toHaveBeenCalled();
  });
});
