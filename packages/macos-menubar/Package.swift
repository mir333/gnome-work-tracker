// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "WorkTracker",
    platforms: [.macOS(.v13)],
    targets: [
        // Pure logic (networking, models, parsing) — no AppKit, unit-tested.
        .target(name: "WorkTrackerCore"),
        // The menu bar app itself (AppKit).
        .executableTarget(name: "WorkTracker", dependencies: ["WorkTrackerCore"]),
        .testTarget(name: "WorkTrackerCoreTests", dependencies: ["WorkTrackerCore"]),
    ]
)
