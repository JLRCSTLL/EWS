import Foundation
import ActivityKit

struct TANOVIQAlertAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var priority: String
        var message: String
        var updatedAt: Double
        var acknowledged: Bool
    }
    var alertID: String
    var userID: String
}
struct Personnel: Decodable {
    let id: String
    let name: String
    let username: String
    let onDuty: Bool
    let locationSharing: Bool
    let dutyProjectId: String?
}
struct AlertMessage: Decodable, Identifiable {
    let id: String
    let content: String
    let priority: String
    let created_at: String
    let read_at: String?
    let received_at: String?
    let target_label: String?
    var date: Date { ISO8601DateFormatter.fractional.date(from: created_at) ?? ISO8601DateFormatter().date(from: created_at) ?? .distantPast }
    var urgent: Bool { priority == "high" || priority == "critical" }
}
struct DutyProject: Decodable, Identifiable { let id: String; let name: String; let status: String }
struct PersonnelState: Decodable { let user: Personnel; let alerts: [AlertMessage]; let projects: [DutyProject] }
struct ServerReply: Decodable { let ok: Bool? }
struct RegisterReply: Decodable { let recoveryCode: String }
struct LocationCredential: Decodable { let token: String; let userId: String }
extension ISO8601DateFormatter {
    static var fractional: ISO8601DateFormatter { let value = ISO8601DateFormatter(); value.formatOptions = [.withInternetDateTime, .withFractionalSeconds]; return value }
}
extension Notification.Name {
    static let tanoviqAlertChanged = Notification.Name("tanoviqAlertChanged")
    static let tanoviqOpenAlert = Notification.Name("tanoviqOpenAlert")
}
