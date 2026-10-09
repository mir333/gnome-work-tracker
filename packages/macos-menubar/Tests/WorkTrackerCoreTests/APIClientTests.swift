import XCTest
@testable import WorkTrackerCore

final class APIClientTests: XCTestCase {
    let client = APIClient(baseURL: "https://tracker.example.com//", token: " tok123 ")

    func testNormalizesBaseURLAndToken() {
        XCTAssertEqual(client.baseURL, "https://tracker.example.com")
        XCTAssertEqual(client.token, "tok123")
    }

    func testBuildsGetRequests() throws {
        let r = try client.makeRequest("GET", ["trigger", client.token, "acme"])
        XCTAssertEqual(r.url?.absoluteString, "https://tracker.example.com/api/trigger/tok123/acme")
        XCTAssertEqual(r.httpMethod, "GET")
        XCTAssertNil(r.httpBody)
    }

    func testPercentEncodesPathSegments() throws {
        let r = try client.makeRequest("GET", ["trigger", "a/b c", "x?y"])
        XCTAssertEqual(r.url?.absoluteString, "https://tracker.example.com/api/trigger/a%2Fb%20c/x%3Fy")
    }

    func testBuildsJSONBody() throws {
        let r = try client.makeRequest("POST", ["trigger", "t", "active", "description"], body: ["description": "Hi"])
        XCTAssertEqual(r.value(forHTTPHeaderField: "Content-Type"), "application/json")
        XCTAssertEqual(String(data: r.httpBody!, encoding: .utf8), #"{"description":"Hi"}"#)
    }

    func testRejectsInvalidBaseURL() {
        for base in ["", "tracker.example.com", "ftp://x.com"] {
            XCTAssertThrowsError(try APIClient(baseURL: base, token: "t").makeRequest("GET", ["status", "t"]), base)
        }
    }

    func testDecodesWorkItemWithMillisecondDates() throws {
        let json = #"{"ok":true,"workItem":{"id":"w1","startedAt":"2026-10-09T07:15:00.123Z","endedAt":null,"project":{"id":"p","slug":"acme","name":"Acme"}}}"#
        let r = try APIClient.decoder.decode(WorkItemResponse.self, from: Data(json.utf8))
        XCTAssertEqual(r.workItem?.id, "w1")
        XCTAssertEqual(r.workItem?.project?.slug, "acme")
        XCTAssertEqual(r.workItem?.startedAt.timeIntervalSince1970 ?? 0, 1_791_530_100.123, accuracy: 0.001)
    }

    func testDecodesStatusWithNoActiveItem() throws {
        let json = #"{"active":null,"today":[]}"#
        XCTAssertNil(try APIClient.decoder.decode(StatusResponse.self, from: Data(json.utf8)).active)
    }
}
