import Foundation
import Combine

@MainActor final class AppStore: ObservableObject {
    @Published var state: PersonnelState?
    @Published var ready = false
    @Published var busy = false
    @Published var error = ""
    @Published var recoveryCode = ""
    private var refreshing = false
    private var generation = 0
    func refresh() async {
        guard !refreshing else { return }; refreshing = true; let current = generation
        defer { refreshing = false; ready = true }
        guard SecureStore.value("session") != nil else { return }
        do {
            let result: PersonnelState = try await API.shared.call("/state?view=public")
            guard generation == current else { return }
            state = result; error = ""; try SecureStore.set("userID", result.user.id)
            if !result.user.onDuty && DutyLocation.shared.sharing { try? await DutyLocation.shared.end() }
            for alert in result.alerts where alert.received_at == nil {
                let _: ServerReply? = try? await API.shared.call("/alerts/\(alert.id)/receipt", method: "POST", body: ["read": false])
            }
        } catch APIError.unauthorized { await clearSignIn() }
        catch { if generation == current { self.error = error.localizedDescription } }
    }
    func signIn(username: String, password: String, name: String? = nil) async {
        await run {
            if let name {
                let reply: RegisterReply = try await API.shared.call("/auth/register", method: "POST", body: ["username": username, "password": password, "name": name]); recoveryCode = reply.recoveryCode
            } else { let _: ServerReply = try await API.shared.call("/auth/login", method: "POST", body: ["username": username, "password": password]) }
            await refresh(); await PushCoordinator.shared.enable()
        }
    }
    func acknowledge(_ alert: AlertMessage) async {
        guard let user = state?.user else { return }
        await run { try await API.shared.acknowledge(alert.id, userID: user.id); await AlertActions.dismiss(alert.id, userID: user.id); await refresh() }
    }
    func signOut() async {
        await run {
            if state?.user.onDuty == true || DutyLocation.shared.sharing { try await DutyLocation.shared.end() }
            let _: ServerReply = try await API.shared.call("/auth/logout", method: "POST", body: [:])
            await clearSignIn()
        }
    }
    private func clearSignIn() async {
        generation += 1; DutyLocation.shared.stopLocal(); await PushCoordinator.shared.signOut()
        try? SecureStore.set("session", nil); try? SecureStore.set("userID", nil); try? SecureStore.set("locationToken", nil)
        UserDefaults.standard.removeObject(forKey: "pendingAlertID")
        state = nil; recoveryCode = ""
    }
    func run(_ work: () async throws -> Void) async {
        guard !busy else { return }; busy = true; error = ""
        defer { busy = false }
        do { try await work() } catch { self.error = error.localizedDescription }
    }
}
