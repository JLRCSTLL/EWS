import Foundation
import ActivityKit
import AppIntents
import UserNotifications

enum AlertActions {
    static func dismiss(_ id: String, userID: String) async {
        guard SecureStore.value("userID") == userID else { return }
        for activity in Activity<TANOVIQAlertAttributes>.activities where activity.attributes.alertID == id && activity.attributes.userID == userID {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
        let center = UNUserNotificationCenter.current()
        let notifications = await center.deliveredNotifications()
        center.removeDeliveredNotifications(withIdentifiers: notifications.filter { $0.request.content.userInfo["alertId"] as? String == id && $0.request.content.userInfo["userId"] as? String == userID }.map { $0.request.identifier })
    }
}
struct AcknowledgeAlertIntent: LiveActivityIntent {
    static var title: LocalizedStringResource = "Acknowledge TANOVIQ alert"
    static var openAppWhenRun: Bool = false
    static var authenticationPolicy: IntentAuthenticationPolicy = .requiresAuthentication
    @Parameter(title: "Alert") var alertID: String
    @Parameter(title: "Recipient") var userID: String
    init() {}
    init(alertID: String, userID: String) { self.alertID = alertID; self.userID = userID }
    func perform() async throws -> some IntentResult {
        #if DEBUG
        if alertID == "local-preview" { await AlertActions.dismiss(alertID, userID: userID); return .result() }
        #endif
        try await API.shared.acknowledge(alertID, userID: userID)
        await AlertActions.dismiss(alertID, userID: userID)
        return .result()
    }
}
