import UIKit
import UserNotifications
import ActivityKit
import Combine

@MainActor final class PushCoordinator: ObservableObject {
    static let shared = PushCoordinator()
    @Published var status = "Notification setup required"
    private var observing = false
    private var activityTasks: [String: Task<Void, Never>] = [:]
    private var activityTokens: [String: String] = [:]
    private var liveStartToken: String?
    private var deviceToken: String? { UserDefaults.standard.string(forKey: "apnsDevice") }
    func observe() {
        guard !observing else { return }; observing = true
        if let token = Activity<TANOVIQAlertAttributes>.pushToStartToken { liveStartToken = token.hex }
        Task { for await token in Activity<TANOVIQAlertAttributes>.pushToStartTokenUpdates { liveStartToken = token.hex; await register() } }
        Task { for await activity in Activity<TANOVIQAlertAttributes>.activityUpdates { observe(activity) } }
        for activity in Activity<TANOVIQAlertAttributes>.activities { observe(activity) }
    }
    private func observe(_ activity: Activity<TANOVIQAlertAttributes>) {
        guard activityTasks[activity.id] == nil else { return }
        if let token = activity.pushToken { activityTokens[activity.id] = token.hex; Task { await registerActivity(activity) } }
        activityTasks[activity.id] = Task {
            for await token in activity.pushTokenUpdates {
                activityTokens[activity.id] = token.hex
                await registerActivity(activity)
            }
        }
    }
    func enable() async {
        observe()
        do {
            var options: UNAuthorizationOptions = [.alert, .sound, .badge]
            // Only enable this key after Apple grants the restricted entitlement.
            if Bundle.main.object(forInfoDictionaryKey: "TANOVIQCriticalAlertsApproved") as? Bool == true { options.insert(.criticalAlert) }
            let granted = try await UNUserNotificationCenter.current().requestAuthorization(options: options)
            guard granted else { status = "Notifications are blocked. Allow Mobile Phone notifications in Settings."; return }
            UIApplication.shared.registerForRemoteNotifications()
            await register()
        } catch { status = error.localizedDescription }
    }
    func receivedDeviceToken(_ token: Data) { UserDefaults.standard.set(token.hex, forKey: "apnsDevice"); Task { await register() } }
    func register() async {
        guard SecureStore.value("session") != nil, let deviceToken else { status = "Waiting for Apple device registration"; return }
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else { status = "Allow notifications in iPhone Settings"; return }
        #if DEBUG
        let environment = "sandbox"
        #else
        let environment = "production"
        #endif
        do {
            let _: ServerReply = try await API.shared.call("/push/ios", method: "POST", body: [
                "token": deviceToken, "environment": environment, "liveStartToken": liveStartToken as Any? ?? NSNull(),
                "liveEnabled": ActivityAuthorizationInfo().areActivitiesEnabled, "criticalEnabled": settings.criticalAlertSetting == .enabled])
            status = "iPhone push registration connected"
            for activity in Activity<TANOVIQAlertAttributes>.activities { await registerActivity(activity) }
        } catch { status = error.localizedDescription }
    }
    private func registerActivity(_ activity: Activity<TANOVIQAlertAttributes>) async {
        guard let deviceToken, let token = activityTokens[activity.id], SecureStore.value("userID") == activity.attributes.userID else { return }
        do {
            let _: ServerReply = try await API.shared.call("/push/ios/activity", method: "POST", body: ["deviceToken": deviceToken, "token": token, "alertId": activity.attributes.alertID])
        } catch { status = "Live Activity updates are waiting for a connection" }
    }
    func signOut() async {
        for task in activityTasks.values { task.cancel() }; activityTasks.removeAll(); activityTokens.removeAll()
        for activity in Activity<TANOVIQAlertAttributes>.activities { await activity.end(nil, dismissalPolicy: .immediate) }
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UNUserNotificationCenter.current().removeAllPendingNotificationRequests()
        status = "Sign in to reconnect notifications"
    }
    #if DEBUG
    func previewLiveActivity() {
        guard let user = SecureStore.value("userID") else { return }
        do {
            let attributes = TANOVIQAlertAttributes(alertID: "local-preview", userID: user)
            let content = TANOVIQAlertAttributes.ContentState(priority: "high", message: "LOCAL PREVIEW — No emergency. Expand Dynamic Island to view this sample message.", updatedAt: Date().timeIntervalSince1970, acknowledged: false)
            _ = try Activity.request(attributes: attributes, content: ActivityContent(state: content, staleDate: Date().addingTimeInterval(60)), pushType: nil)
        } catch { status = error.localizedDescription }
    }
    #endif
}
private extension Data { var hex: String { map { String(format: "%02x", $0) }.joined() } }

final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        let center = UNUserNotificationCenter.current(); center.delegate = self
        let read = UNNotificationAction(identifier: "ACKNOWLEDGE", title: "Acknowledge", options: [.authenticationRequired])
        let dismiss = UNNotificationAction(identifier: "DISMISS_ALERT", title: "Dismiss alert", options: [])
        center.setNotificationCategories([UNNotificationCategory(identifier: "TANOVIQ_ALERT", actions: [read, dismiss], intentIdentifiers: [], options: [.customDismissAction])])
        Task { @MainActor in PushCoordinator.shared.observe(); DutyLocation.shared.resumeIfActive() }
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) {
        Task { @MainActor in PushCoordinator.shared.receivedDeviceToken(token) }
    }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        Task { @MainActor in PushCoordinator.shared.status = "Apple push registration failed: " + error.localizedDescription }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
        let payload = notification.request.content.userInfo
        guard let user = payload["userId"] as? String, user == SecureStore.value("userID") else { completion([]); return }
        completion([.banner, .list, .sound]); NotificationCenter.default.post(name: .tanoviqAlertChanged, object: nil)
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completion: @escaping () -> Void) {
        let payload = response.notification.request.content.userInfo
        guard let id = payload["alertId"] as? String, let user = payload["userId"] as? String, user == SecureStore.value("userID") else { completion(); return }
        Task {
            defer { completion() }
            if response.actionIdentifier == "ACKNOWLEDGE" {
                do { try await API.shared.acknowledge(id, userID: user); await AlertActions.dismiss(id, userID: user) }
                catch {
                    // Preserve the alert, never claim a failed acknowledgment was sent.
                    let content = UNMutableNotificationContent(); content.title = "Acknowledgment not sent"; content.body = "Reconnect and acknowledge the Mobile Phone message again."; content.userInfo = payload; content.categoryIdentifier = "TANOVIQ_ALERT"
                    try? await center.add(UNNotificationRequest(identifier: "retry-" + id, content: content, trigger: nil))
                }
            } else if response.actionIdentifier == "DISMISS_ALERT" || response.actionIdentifier == UNNotificationDismissActionIdentifier {
                await AlertActions.dismiss(id, userID: user)
            } else {
                UserDefaults.standard.set(id, forKey: "pendingAlertID")
                await MainActor.run { NotificationCenter.default.post(name: .tanoviqOpenAlert, object: id) }
            }
        }
    }
    func application(_ application: UIApplication, didReceiveRemoteNotification payload: [AnyHashable: Any], fetchCompletionHandler completion: @escaping (UIBackgroundFetchResult) -> Void) {
        guard let id = payload["alertId"] as? String, UUID(uuidString: id) != nil, payload["userId"] as? String == SecureStore.value("userID") else { completion(.noData); return }
        Task {
            do { let _: ServerReply = try await API.shared.call("/alerts/\(id)/receipt", method: "POST", body: ["read": false]); completion(.newData) }
            catch { completion(.failed) }
        }
    }
}
