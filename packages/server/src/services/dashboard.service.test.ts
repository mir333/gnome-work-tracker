import { describe, test, expect } from "bun:test";
import { toTokenSlots } from "./dashboard.service";

describe("toTokenSlots", () => {
  test("maps slots with slug, name and short name", () => {
    const result = toTokenSlots([
      { slot: 1, project: { slug: "acme", name: "Acme Corporation", shortName: "Acme" } },
      { slot: 3, project: { slug: "beta", name: "Beta", shortName: null } },
    ]);
    expect(result).toEqual([
      { slot: 1, projectSlug: "acme", projectName: "Acme Corporation", projectShortName: "Acme" },
      { slot: 3, projectSlug: "beta", projectName: "Beta", projectShortName: null },
    ]);
  });
});
