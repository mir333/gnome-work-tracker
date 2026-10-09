import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking // URLSession on Linux (lets `swift test` run in CI)
#endif

public enum APIError: Error, LocalizedError, Equatable {
    case invalidURL
    case http(status: Int, body: String)
    case invalidResponse

    public var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid server URL"
        case let .http(status, body): return "HTTP \(status): \(body)"
        case .invalidResponse: return "Invalid server response"
        }
    }
}

/// Thin client over the server's token-authenticated endpoints
/// (the same ones the GNOME extension uses).
public final class APIClient {
    public let baseURL: String
    public let token: String
    private let session: URLSession

    public init(baseURL: String, token: String, session: URLSession = .shared) {
        self.baseURL = baseURL.trimmingCharacters(in: .whitespaces).replacingOccurrences(
            of: "/+$", with: "", options: .regularExpression)
        self.token = token.trimmingCharacters(in: .whitespacesAndNewlines)
        self.session = session
    }

    // MARK: - Endpoints

    public func dashboard() async throws -> [DashboardSlotDTO] {
        try await send(makeRequest("GET", ["dashboard", token]), as: [DashboardSlotDTO].self)
    }

    public func activeWorkItem() async throws -> WorkItem? {
        try await send(makeRequest("GET", ["status", token]), as: StatusResponse.self).active
    }

    public func start(slug: String) async throws -> WorkItem? {
        try await send(makeRequest("GET", ["trigger", token, slug]), as: WorkItemResponse.self).workItem
    }

    public func stop() async throws {
        _ = try await sendRaw(makeRequest("GET", ["trigger", token, "stop"]))
    }

    public func updateStart(workItemId: String, startedAt: Date) async throws -> WorkItem? {
        let body = ["startedAt": Self.isoFormatter.string(from: startedAt)]
        return try await send(
            makeRequest("PUT", ["trigger", token, "work-items", workItemId], body: body),
            as: WorkItemResponse.self
        ).workItem
    }

    public func addNote(_ text: String) async throws {
        _ = try await sendRaw(
            makeRequest("POST", ["trigger", token, "active", "description"], body: ["description": text]))
    }

    // MARK: - Request building (internal for tests)

    func makeRequest(_ method: String, _ segments: [String], body: [String: String]? = nil) throws -> URLRequest {
        var allowed = CharacterSet.urlPathAllowed
        allowed.remove(charactersIn: "/")
        let encoded = try segments.map { segment -> String in
            guard let s = segment.addingPercentEncoding(withAllowedCharacters: allowed) else {
                throw APIError.invalidURL
            }
            return s
        }
        guard let url = URL(string: "\(baseURL)/api/" + encoded.joined(separator: "/")),
              let scheme = url.scheme?.lowercased(), ["http", "https"].contains(scheme), url.host != nil
        else { throw APIError.invalidURL }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.timeoutInterval = 10
        if let body {
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body, options: [.sortedKeys])
        }
        return request
    }

    // MARK: - Transport

    private func sendRaw(_ request: URLRequest) async throws -> Data {
        let (data, response) = try await fetch(request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard http.statusCode == 200 else {
            // Truncate: error bodies may be whole HTML pages from a reverse proxy.
            let body = String(decoding: data.prefix(200), as: UTF8.self)
            throw APIError.http(status: http.statusCode, body: body)
        }
        return data
    }

    private func fetch(_ request: URLRequest) async throws -> (Data, URLResponse) {
        #if canImport(FoundationNetworking)
        // Linux Foundation lacks the async URLSession API; only used for CI tests.
        return try await withCheckedThrowingContinuation { continuation in
            session.dataTask(with: request) { data, response, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let data, let response {
                    continuation.resume(returning: (data, response))
                } else {
                    continuation.resume(throwing: APIError.invalidResponse)
                }
            }.resume()
        }
        #else
        return try await session.data(for: request)
        #endif
    }

    private func send<T: Decodable>(_ request: URLRequest, as type: T.Type) async throws -> T {
        let data = try await sendRaw(request)
        return try Self.decoder.decode(T.self, from: data)
    }

    // MARK: - JSON dates (server emits ISO-8601 with milliseconds)

    static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    private static let isoFormatterNoFraction: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .custom { decoder in
            let container = try decoder.singleValueContainer()
            let string = try container.decode(String.self)
            if let date = APIClient.isoFormatter.date(from: string)
                ?? APIClient.isoFormatterNoFraction.date(from: string) {
                return date
            }
            throw DecodingError.dataCorruptedError(
                in: container, debugDescription: "Invalid ISO-8601 date: \(string)")
        }
        return d
    }()
}
