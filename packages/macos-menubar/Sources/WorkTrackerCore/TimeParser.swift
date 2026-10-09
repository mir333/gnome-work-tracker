import Foundation

public enum TimeParser {
    /// Parses "H:MM" / "HH:MM" (24h) into that time today. Returns nil when invalid.
    /// Mirrors the GNOME extension's validation.
    public static func todayAt(_ text: String, now: Date = Date(), calendar: Calendar = .current) -> Date? {
        let trimmed = text.trimmingCharacters(in: .whitespaces)
        let parts = trimmed.split(separator: ":", omittingEmptySubsequences: false)
        guard parts.count == 2,
              (1...2).contains(parts[0].count), parts[1].count == 2,
              parts.allSatisfy({ $0.allSatisfy { ("0"..."9").contains($0) } }),
              let hours = Int(parts[0]), let minutes = Int(parts[1]),
              (0...23).contains(hours), (0...59).contains(minutes)
        else { return nil }
        return calendar.date(bySettingHour: hours, minute: minutes, second: 0, of: now)
    }

    /// Formats a date as "HH:MM" in the calendar's time zone.
    public static func hhmm(_ date: Date, calendar: Calendar = .current) -> String {
        let c = calendar.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }
}
