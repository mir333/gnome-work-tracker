import XCTest
@testable import WorkTrackerCore

final class TimeParserTests: XCTestCase {
    var calendar: Calendar = {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "Europe/Prague")!
        return c
    }()

    // 2026-10-09 15:30 Prague time
    lazy var now: Date = calendar.date(from: DateComponents(year: 2026, month: 10, day: 9, hour: 15, minute: 30))!

    func testParsesValidTimesOnToday() {
        let d = TimeParser.todayAt("8:05", now: now, calendar: calendar)!
        let c = calendar.dateComponents([.year, .month, .day, .hour, .minute, .second], from: d)
        XCTAssertEqual([c.year, c.month, c.day, c.hour, c.minute, c.second], [2026, 10, 9, 8, 5, 0])
        XCTAssertNotNil(TimeParser.todayAt("23:59", now: now, calendar: calendar))
        XCTAssertNotNil(TimeParser.todayAt(" 00:00 ", now: now, calendar: calendar))
    }

    func testRejectsInvalidTimes() {
        for input in ["", "8", "24:00", "12:60", "12:5", "123:00", "ab:cd", "12:00:00", "-1:00", "+1:00", "１２:００"] {
            XCTAssertNil(TimeParser.todayAt(input, now: now, calendar: calendar), input)
        }
    }

    func testFormatsHHMM() {
        let d = calendar.date(from: DateComponents(year: 2026, month: 1, day: 1, hour: 7, minute: 3))!
        XCTAssertEqual(TimeParser.hhmm(d, calendar: calendar), "07:03")
    }
}
