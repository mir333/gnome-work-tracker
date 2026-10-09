import XCTest
@testable import WorkTrackerCore

final class SlotMapperTests: XCTestCase {
    func testPrefersShortNameAndFallsBackToName() {
        let slots = SlotMapper.slots(from: [
            DashboardSlotDTO(slot: 2, projectSlug: "beta", projectName: "Beta Project", projectShortName: nil),
            DashboardSlotDTO(slot: 1, projectSlug: "acme", projectName: "Acme Corporation", projectShortName: "Acme"),
            DashboardSlotDTO(slot: 3, projectSlug: "gamma", projectName: "Gamma", projectShortName: "  "),
        ])
        XCTAssertEqual(slots, [
            Slot(index: 0, slug: "acme", label: "Acme"),
            Slot(index: 1, slug: "beta", label: "Beta Project"),
            Slot(index: 2, slug: "gamma", label: "Gamma"),
        ])
    }

    func testSkipsOutOfRangeAndEmptySlugs() {
        let slots = SlotMapper.slots(from: [
            DashboardSlotDTO(slot: 0, projectSlug: "zero", projectName: "Zero", projectShortName: nil),
            DashboardSlotDTO(slot: 7, projectSlug: "seven", projectName: "Seven", projectShortName: nil),
            DashboardSlotDTO(slot: 4, projectSlug: "", projectName: "Empty", projectShortName: nil),
            DashboardSlotDTO(slot: 6, projectSlug: "six", projectName: nil, projectShortName: nil),
        ])
        XCTAssertEqual(slots, [Slot(index: 5, slug: "six", label: "six")])
    }

    func testDecodesDashboardJSONWithoutShortNameField() throws {
        // Older servers don't send projectShortName.
        let json = #"[{"slot":1,"projectSlug":"acme","projectName":"Acme"}]"#
        let dto = try APIClient.decoder.decode([DashboardSlotDTO].self, from: Data(json.utf8))
        XCTAssertEqual(SlotMapper.slots(from: dto), [Slot(index: 0, slug: "acme", label: "Acme")])
    }

    func testActiveIndexMatchesBySlug() {
        let slots = [Slot(index: 0, slug: "acme", label: "A"), Slot(index: 3, slug: "beta", label: "B")]
        let item = WorkItem(id: "w1", startedAt: Date(), project: ProjectRef(slug: "beta"))
        XCTAssertEqual(SlotMapper.activeIndex(in: slots, for: item), 3)
        XCTAssertNil(SlotMapper.activeIndex(in: slots, for: nil))
        let other = WorkItem(id: "w2", startedAt: Date(), project: ProjectRef(slug: "other"))
        XCTAssertNil(SlotMapper.activeIndex(in: slots, for: other))
    }
}
