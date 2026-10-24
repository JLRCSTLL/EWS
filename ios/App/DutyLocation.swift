import Foundation
import CoreLocation
import Combine

// Core Location delivers delegates on the run loop where its manager was created.
// This manager is created and used on MainActor; preserve that legacy contract.
@MainActor final class DutyLocation: NSObject, ObservableObject, @preconcurrency CLLocationManagerDelegate {
    static let shared = DutyLocation()
    @Published var status = "Off duty · location is not shared"
    @Published var sharing = false
    @Published var lastFix: CLLocation?
    private let manager = CLLocationManager()
    private var permission: CheckedContinuation<Void, Error>?
    private var sending = false
    private var epoch = 0
    private var lastUpload = Date.distantPast
    override init() {
        super.init(); manager.delegate = self; manager.desiredAccuracy = kCLLocationAccuracyBest
        manager.distanceFilter = kCLDistanceFilterNone; manager.activityType = .other
        manager.pausesLocationUpdatesAutomatically = false; manager.allowsBackgroundLocationUpdates = true
        manager.showsBackgroundLocationIndicator = true
    }
    func requirePermission() async throws {
        guard CLLocationManager.locationServicesEnabled() else { throw APIError.message("Turn on iPhone Location Services before starting duty.") }
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: break
        case .notDetermined:
            guard permission == nil else { throw APIError.message("Respond to the location permission request first.") }
            try await withCheckedThrowingContinuation { continuation in permission = continuation; manager.requestWhenInUseAuthorization() }
        default: throw APIError.message("Allow location in iPhone Settings to start duty.")
        }
        if manager.authorizationStatus == .authorizedWhenInUse { manager.requestAlwaysAuthorization() }
    }
    func begin(projectID: String?) async throws {
        try await retryRemoval()
        try await requirePermission()
        let _: ServerReply = try await API.shared.call("/duty", method: "PUT", body: ["onDuty": true, "projectId": projectID as Any? ?? NSNull()])
        do {
            let credential: LocationCredential = try await API.shared.call("/location/share", method: "POST", body: [:])
            try SecureStore.set("locationToken", credential.token)
            startUpdates()
        } catch {
            let _: ServerReply? = try? await API.shared.call("/duty", method: "PUT", body: ["onDuty": false])
            throw error
        }
    }
    private func startUpdates() {
        sharing = true; status = "Waiting for a fresh GPS fix…"; manager.startUpdatingLocation()
    }
    func resumeIfActive() {
        Task { try? await retryRemoval() }
        guard SecureStore.value("pendingLocationStop") == nil, SecureStore.value("locationToken") != nil, SecureStore.value("session") != nil else { return }
        if manager.authorizationStatus == .authorizedAlways || manager.authorizationStatus == .authorizedWhenInUse { startUpdates() }
    }
    func end() async throws {
        stopLocal()
        if let token = SecureStore.value("locationToken") {
            try SecureStore.set("pendingLocationStop", token)
            try SecureStore.set("locationToken", nil)
            try await retryRemoval()
        } else {
            let _: ServerReply = try await API.shared.call("/duty", method: "PUT", body: ["onDuty": false])
        }
    }
    private func retryRemoval() async throws {
        guard let token = SecureStore.value("pendingLocationStop") else { return }
        do { let _: ServerReply = try await API.shared.call("/location/native", method: "DELETE", body: [:], bearer: token) }
        catch APIError.unauthorized { /* A revoked token can no longer upload. */ }
        catch { status = "Tracking stopped here. Reconnect to clear the last map position."; throw error }
        try SecureStore.set("pendingLocationStop", nil)
    }
    func stopLocal() { epoch += 1; manager.stopUpdatingLocation(); sharing = false; lastFix = nil; status = "Off duty · location is not shared" }
    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        switch manager.authorizationStatus {
        case .authorizedAlways, .authorizedWhenInUse: permission?.resume(); permission = nil
        case .denied, .restricted:
            permission?.resume(throwing: APIError.message("Location permission was declined.")); permission = nil
            if sharing { Task { try? await end() } }
        default: break
        }
    }
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard sharing, !sending, let fix = locations.last, let token = SecureStore.value("locationToken"), fix.horizontalAccuracy >= 0,
            abs(fix.timestamp.timeIntervalSinceNow) < 10, abs(fix.coordinate.latitude) <= 85, Date().timeIntervalSince(lastUpload) >= 1 else { return }
        sending = true; lastUpload = Date(); lastFix = fix; let generation = epoch
        Task {
            defer { sending = false }
            do {
                let _: ServerReply = try await API.shared.call("/location/native", method: "PUT", body: ["lat": fix.coordinate.latitude, "lng": fix.coordinate.longitude,
                    "accuracy": fix.horizontalAccuracy, "capturedAt": ISO8601DateFormatter.fractional.string(from: fix.timestamp)], bearer: token)
                if epoch == generation { status = "Shared at " + fix.timestamp.formatted(date: .omitted, time: .standard) + " · ±\(Int(fix.horizontalAccuracy)) m" }
            } catch APIError.unauthorized {
                if epoch == generation { stopLocal(); try? SecureStore.set("locationToken", nil); status = "Duty tracking expired. Sign in and start duty again." }
            } catch { if epoch == generation { status = "Location not sent · reconnecting with the next fresh fix" } }
        }
    }
    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) { status = "GPS unavailable. Check Location Services and try near a window or outdoors." }
}
