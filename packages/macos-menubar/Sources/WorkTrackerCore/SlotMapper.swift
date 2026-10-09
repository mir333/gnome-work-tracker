import Foundation

public enum SlotMapper {
    public static let slotCount = 6

    /// Converts the dashboard response into ordered project buttons.
    /// Label is the project's short name when set, otherwise its full name.
    public static func slots(from dto: [DashboardSlotDTO]) -> [Slot] {
        dto.compactMap { entry -> Slot? in
            guard (1...slotCount).contains(entry.slot),
                  let slug = entry.projectSlug, !slug.isEmpty
            else { return nil }
            return Slot(index: entry.slot - 1, slug: slug, label: label(for: entry, fallback: slug))
        }
        .sorted { $0.index < $1.index }
    }

    static func label(for entry: DashboardSlotDTO, fallback: String) -> String {
        for candidate in [entry.projectShortName, entry.projectName] {
            let trimmed = candidate?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if !trimmed.isEmpty { return trimmed }
        }
        return fallback
    }

    /// Index of the slot whose project matches the active work item, or nil.
    public static func activeIndex(in slots: [Slot], for item: WorkItem?) -> Int? {
        guard let slug = item?.project?.slug else { return nil }
        return slots.first { $0.slug == slug }?.index
    }
}
