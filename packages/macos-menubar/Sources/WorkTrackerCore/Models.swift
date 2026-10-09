import Foundation

/// One entry of `GET /api/dashboard/:token`.
public struct DashboardSlotDTO: Decodable, Equatable {
    public let slot: Int
    public let projectSlug: String?
    public let projectName: String?
    public let projectShortName: String?

    public init(slot: Int, projectSlug: String?, projectName: String?, projectShortName: String?) {
        self.slot = slot
        self.projectSlug = projectSlug
        self.projectName = projectName
        self.projectShortName = projectShortName
    }
}

public struct ProjectRef: Decodable, Equatable {
    public let slug: String
}

/// The subset of a server work item the menu bar app needs.
public struct WorkItem: Decodable, Equatable {
    public let id: String
    public let startedAt: Date
    public let project: ProjectRef?

    public init(id: String, startedAt: Date, project: ProjectRef? = nil) {
        self.id = id
        self.startedAt = startedAt
        self.project = project
    }
}

/// `{ ok, workItem }` returned by trigger / update / note endpoints.
struct WorkItemResponse: Decodable {
    let workItem: WorkItem?
}

/// `{ active, today }` returned by `GET /api/status/:token`.
struct StatusResponse: Decodable {
    let active: WorkItem?
}

/// A configured project button (slot index is 0-based, 0...5).
public struct Slot: Equatable {
    public let index: Int
    public let slug: String
    public let label: String

    public init(index: Int, slug: String, label: String) {
        self.index = index
        self.slug = slug
        self.label = label
    }
}
