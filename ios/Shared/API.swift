import Foundation

enum APIError: LocalizedError {
    case message(String), unauthorized
    var errorDescription: String? { switch self { case .message(let value): return value; case .unauthorized: return "Sign in again to reconnect this iPhone." } }
}
actor API {
    static let shared = API()
    static let origin = "https://ews-kappa.vercel.app"
    private let session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.httpCookieStorage = nil; config.httpShouldSetCookies = false
        config.timeoutIntervalForRequest = 20; config.timeoutIntervalForResource = 30
        return URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    }()
    func call<T: Decodable>(_ path: String, method: String = "GET", body: [String: Any]? = nil, bearer: String? = nil) async throws -> T {
        var request = URLRequest(url: URL(string: Self.origin + "/api" + path)!)
        request.httpMethod = method; request.cachePolicy = .reloadIgnoringLocalCacheData
        request.setValue(Self.origin, forHTTPHeaderField: "Origin")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearer { request.setValue("Bearer " + bearer, forHTTPHeaderField: "Authorization") }
        else if let cookie = SecureStore.value("session") { request.setValue("eligtas_session=" + cookie, forHTTPHeaderField: "Cookie") }
        if let body { request.httpBody = try JSONSerialization.data(withJSONObject: body); request.setValue("application/json", forHTTPHeaderField: "Content-Type") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.url?.host == "ews-kappa.vercel.app" else { throw APIError.message("Unexpected service response.") }
        if http.statusCode == 401 { throw APIError.unauthorized }
        guard (200...299).contains(http.statusCode) else {
            let error = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
            throw APIError.message(error?["error"] as? String ?? "The service is unavailable. Please retry.")
        }
        if path == "/auth/login" || path == "/auth/register" {
            let headers = http.allHeaderFields.reduce(into: [String: String]()) { result, pair in result[String(describing: pair.key)] = String(describing: pair.value) }
            guard let cookie = HTTPCookie.cookies(withResponseHeaderFields: headers, for: http.url!).first(where: { $0.name == "eligtas_session" }), cookie.value.count == 43 else { throw APIError.message("The service did not return a valid sign-in.") }
            try SecureStore.set("session", cookie.value)
        }
        return try JSONDecoder().decode(T.self, from: data)
    }
    func acknowledge(_ id: String, userID: String) async throws {
        guard UUID(uuidString: id) != nil, SecureStore.value("userID") == userID else { throw APIError.unauthorized }
        let _: ServerReply = try await call("/alerts/\(id)/receipt", method: "POST", body: ["read": true])
        NotificationCenter.default.post(name: .tanoviqAlertChanged, object: nil)
    }
}
private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
