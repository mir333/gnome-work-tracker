import { describe, test, expect, mock, beforeEach } from "bun:test";

const mockFindById = mock(() => Promise.resolve(null as any));
const mockFindBySlug = mock(() => Promise.resolve(null as any));
const mockCreate = mock((data: any) => Promise.resolve({ id: "p1", ...data }));
const mockUpdate = mock((id: string, data: any) => Promise.resolve({ id, ...data }));

mock.module("../repositories/project.repository", () => ({
  projectRepository: {
    findById: mockFindById,
    findBySlug: mockFindBySlug,
    create: mockCreate,
    update: mockUpdate,
  },
}));

const { projectService, normalizeShortName } = await import("./project.service");

const USER_ID = "user-1";

beforeEach(() => {
  mockFindById.mockReset();
  mockFindBySlug.mockReset();
  mockCreate.mockClear();
  mockUpdate.mockClear();
  mockFindBySlug.mockResolvedValue(null);
});

describe("normalizeShortName", () => {
  test("trims whitespace", () => {
    expect(normalizeShortName("  ACME  ")).toBe("ACME");
  });

  test("empty or whitespace-only becomes null", () => {
    expect(normalizeShortName("")).toBeNull();
    expect(normalizeShortName("   ")).toBeNull();
    expect(normalizeShortName(null)).toBeNull();
  });

  test("undefined stays undefined (field not provided)", () => {
    expect(normalizeShortName(undefined)).toBeUndefined();
  });

  test("accepts exactly 12 characters", () => {
    expect(normalizeShortName("123456789012")).toBe("123456789012");
  });

  test("rejects more than 12 characters", () => {
    expect(() => normalizeShortName("1234567890123")).toThrow(
      "Short name must be at most 12 characters"
    );
  });

  test("rejects non-string values", () => {
    expect(() => normalizeShortName(42 as any)).toThrow("Short name must be a string");
  });
});

describe("projectService.create", () => {
  test("stores normalized short name", async () => {
    await projectService.create(USER_ID, "Acme Corporation", "  Acme ");
    expect(mockCreate).toHaveBeenCalledWith({
      name: "Acme Corporation",
      slug: "acme-corporation",
      userId: USER_ID,
      shortName: "Acme",
    });
  });

  test("stores null short name when omitted", async () => {
    await projectService.create(USER_ID, "Acme");
    expect(mockCreate).toHaveBeenCalledWith({
      name: "Acme",
      slug: "acme",
      userId: USER_ID,
      shortName: null,
    });
  });
});

describe("projectService.update", () => {
  test("updates short name and clears it with empty string", async () => {
    mockFindById.mockResolvedValue({ id: "p1", userId: USER_ID, slug: "acme" });

    await projectService.update("p1", USER_ID, { shortName: " AC " });
    expect(mockUpdate).toHaveBeenLastCalledWith("p1", { shortName: "AC" });

    await projectService.update("p1", USER_ID, { shortName: "" });
    expect(mockUpdate).toHaveBeenLastCalledWith("p1", { shortName: null });
  });

  test("does not touch short name when not provided", async () => {
    mockFindById.mockResolvedValue({ id: "p1", userId: USER_ID, slug: "acme" });
    await projectService.update("p1", USER_ID, { name: "New" });
    expect(mockUpdate).toHaveBeenLastCalledWith("p1", { name: "New" });
  });

  test("only passes known fields to the repository", async () => {
    mockFindById.mockResolvedValue({ id: "p1", userId: USER_ID, slug: "acme" });
    await projectService.update("p1", USER_ID, { name: "New", userId: "other" } as any);
    expect(mockUpdate).toHaveBeenLastCalledWith("p1", { name: "New" });
  });

  test("throws on too-long short name", async () => {
    mockFindById.mockResolvedValue({ id: "p1", userId: USER_ID, slug: "acme" });
    await expect(
      projectService.update("p1", USER_ID, { shortName: "way-too-long-name" })
    ).rejects.toThrow("Short name must be at most 12 characters");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
