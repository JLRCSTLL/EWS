import SwiftUI
import MapKit
import UIKit

@main struct TANOVIQApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var store = AppStore()
    var body: some Scene { WindowGroup { RootView().environmentObject(store).tint(.teal) } }
}
private enum AppTab: Hashable { case home, alerts, duty, account }
struct RootView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.scenePhase) private var phase
    @State private var tab: AppTab = .home
    @State private var selectedAlert: AlertMessage?
    @State private var pendingAlertID: String?
    var body: some View {
        Group {
            if !store.ready { SplashView() }
            else if store.state == nil { SignInView() }
            else {
                TabView(selection: $tab) {
                    NavigationStack { HomeView(openAlert: { selectedAlert = $0 }, openDuty: { tab = .duty }) }.tabItem { Label("Overview", systemImage: "shield.lefthalf.filled") }.tag(AppTab.home)
                    NavigationStack { InboxView(openAlert: { selectedAlert = $0 }) }.tabItem { Label("Alerts", systemImage: "bell") }.badge(store.state?.alerts.filter { $0.read_at == nil }.count ?? 0).tag(AppTab.alerts)
                    NavigationStack { DutyView() }.tabItem { Label("Duty", systemImage: "location") }.tag(AppTab.duty)
                    NavigationStack { AccountView() }.tabItem { Label("Account", systemImage: "person.crop.circle") }.tag(AppTab.account)
                }
            }
        }
        .sheet(item: $selectedAlert) { alert in AlertDetailView(alert: alert).environmentObject(store).presentationDetents([.medium, .large]).presentationDragIndicator(.visible) }
        .task {
            await store.refresh()
            if store.state != nil { await PushCoordinator.shared.register() }
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(5))
                if phase == .active { await store.refresh(); openPendingAlert() }
            }
        }
        .onChange(of: phase) { _, value in
            if value == .active { Task { await store.refresh(); await PushCoordinator.shared.register(); DutyLocation.shared.resumeIfActive(); openPendingAlert() } }
        }
        .onReceive(NotificationCenter.default.publisher(for: .tanoviqAlertChanged)) { _ in Task { await store.refresh() } }
        .onReceive(NotificationCenter.default.publisher(for: .tanoviqOpenAlert)) { note in
            pendingAlertID = note.object as? String; tab = .alerts
            Task { await store.refresh(); openPendingAlert() }
        }
        .onOpenURL { url in
            guard url.scheme == "tanoviq", url.host == "alert", UUID(uuidString: url.lastPathComponent) != nil else { return }
            pendingAlertID = url.lastPathComponent; tab = .alerts
            Task { await store.refresh(); openPendingAlert() }
        }
    }
    private func openPendingAlert() {
        if pendingAlertID == nil { pendingAlertID = UserDefaults.standard.string(forKey: "pendingAlertID") }
        guard let id = pendingAlertID, let alert = store.state?.alerts.first(where: { $0.id == id }) else { return }
        selectedAlert = alert; pendingAlertID = nil; UserDefaults.standard.removeObject(forKey: "pendingAlertID")
    }
}
struct SplashView: View {
    var body: some View {
        VStack(spacing: 24) { Image("Brand").resizable().scaledToFit().frame(maxWidth: 250).accessibilityLabel("TANOVIQ"); Text("See Risk Before It Strikes.").font(.headline); ProgressView("Connecting to your command center") }
            .padding(32).frame(maxWidth: .infinity, maxHeight: .infinity).background(Color(uiColor: .systemGroupedBackground))
    }
}
struct SignInView: View {
    @EnvironmentObject private var store: AppStore
    @State private var registering = false
    @State private var username = ""
    @State private var password = ""
    @State private var name = ""
    var body: some View {
        NavigationStack {
            Form {
                Section { VStack(alignment: .leading, spacing: 12) {
                    Image(systemName: "dot.radiowaves.left.and.right").font(.largeTitle).foregroundStyle(.teal).accessibilityHidden(true)
                    Text("See Risk\nBefore It Strikes.").font(.largeTitle.bold())
                    Text("Your connection to the command center. Alerts, duty location, and help in one place.").foregroundStyle(.secondary)
                }.padding(.vertical, 18).listRowBackground(Color.clear) }
                Section(registering ? "Create your account" : "Welcome back") {
                    if registering { TextField("Preferred name", text: $name).textContentType(.nickname) }
                    TextField("Username", text: $username).textContentType(.username).textInputAutocapitalization(.never).autocorrectionDisabled()
                    SecureField("Password", text: $password).textContentType(registering ? .newPassword : .password)
                    if registering { Text("Use at least 12 characters. Save the recovery code shown after registration.").font(.caption).foregroundStyle(.secondary) }
                }
                Section {
                    Button { Task { await store.signIn(username: username, password: password, name: registering ? name : nil); password = "" } } label: {
                        HStack { Spacer(); if store.busy { ProgressView() }; Text(registering ? "Create account" : "Sign in").fontWeight(.semibold); Spacer() }.padding(.vertical, 8)
                    }.buttonStyle(.borderedProminent).disabled(store.busy || username.isEmpty || password.isEmpty || (registering && name.isEmpty))
                    Button(registering ? "Already registered? Sign in" : "Create an account") { registering.toggle() }.frame(maxWidth: .infinity)
                }.listRowBackground(Color.clear)
                if !store.error.isEmpty { Section { Label(store.error, systemImage: "exclamationmark.circle").foregroundStyle(.red) } }
                Section { Text("Location is shared only while you are on duty. iPhone permission settings control notifications, background location, and Live Activities.").font(.footnote).foregroundStyle(.secondary) }
            }.navigationTitle("TANOVIQ")
        }
    }
}
struct HomeView: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject private var location = DutyLocation.shared
    var openAlert: (AlertMessage) -> Void
    var openDuty: () -> Void
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Hello, \(store.state?.user.name ?? "personnel")").font(.title2.bold())
                    Text("Stay aware. Stay connected.").foregroundStyle(.secondary)
                }.padding(.top, 4)
                Button(action: openDuty) {
                    Label(location.sharing ? "On duty · location sharing" : "Off duty · location private", systemImage: location.sharing ? "location.fill" : "location.slash")
                        .font(.subheadline.weight(.semibold)).padding(.horizontal, 18).padding(.vertical, 12)
                }.buttonStyle(.plain).modifier(NativeGlassControl()).accessibilityHint("Open your duty and location controls")
                if let latest = store.state?.alerts.first(where: { $0.read_at == nil }) {
                    VStack(alignment: .leading, spacing: 16) {
                        HStack { PriorityLabel(priority: latest.priority); Spacer(); Text("UNREAD").font(.caption2.bold()).foregroundStyle(.secondary) }
                        Text(latest.content).font(.title3.weight(.semibold)).lineLimit(5)
                        HStack { Text(latest.date, style: .relative).font(.caption).foregroundStyle(.secondary); Spacer(); Button("Read alert", systemImage: "arrow.up.right") { openAlert(latest) }.buttonStyle(.borderedProminent) }
                    }.card()
                } else {
                    VStack(alignment: .leading, spacing: 12) { Label("You're up to date", systemImage: "checkmark.message").font(.title3.bold()); Text("No unread messages. This is your inbox status, not a declaration that your area is safe.").foregroundStyle(.secondary) }.card()
                }
                VStack(alignment: .leading, spacing: 16) {
                    Label("Your duty connection", systemImage: "antenna.radiowaves.left.and.right").font(.headline)
                    Text(location.status).foregroundStyle(.secondary)
                    Button("Manage duty", action: openDuty).buttonStyle(.bordered)
                }.card()
                if !store.error.isEmpty { Label(store.error, systemImage: "wifi.exclamationmark").font(.footnote).foregroundStyle(.red).card() }
                Text("TANOVIQ · See Risk Before It Strikes.").font(.caption).foregroundStyle(.secondary).padding(.vertical, 8)
            }.padding(20)
        }.background(Color(uiColor: .systemGroupedBackground)).navigationTitle("Overview")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Refresh", systemImage: "arrow.clockwise") { Task { await store.refresh() } } } }
            .refreshable { await store.refresh() }
    }
}
struct InboxView: View {
    @EnvironmentObject private var store: AppStore
    @State private var search = ""
    var openAlert: (AlertMessage) -> Void
    private var alerts: [AlertMessage] { (store.state?.alerts ?? []).filter { search.isEmpty || $0.content.localizedCaseInsensitiveContains(search) } }
    var body: some View {
        List {
            if alerts.isEmpty { ContentUnavailableView(search.isEmpty ? "No alerts yet" : "No matches", systemImage: "bell.badge", description: Text("Messages sent to your account will appear here.")) }
            ForEach(alerts) { alert in
                Button { openAlert(alert) } label: {
                    VStack(alignment: .leading, spacing: 10) {
                        HStack { PriorityLabel(priority: alert.priority); Spacer(); if alert.read_at == nil { Text("Unread").font(.caption.bold()).foregroundStyle(.teal) } }
                        Text(alert.content).foregroundStyle(.primary).lineLimit(3)
                        Text(alert.date, style: .date).font(.caption).foregroundStyle(.secondary)
                    }.padding(.vertical, 8)
                }.buttonStyle(.plain)
            }
        }.navigationTitle("Alerts").searchable(text: $search, prompt: "Search messages").refreshable { await store.refresh() }
    }
}
struct AlertDetailView: View {
    @EnvironmentObject private var store: AppStore
    @Environment(\.dismiss) private var dismiss
    let alert: AlertMessage
    private var acknowledged: Bool { store.state?.alerts.first(where: { $0.id == alert.id })?.read_at != nil }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    PriorityLabel(priority: alert.priority)
                    Text(alert.content).font(.title3).textSelection(.enabled)
                    Text(alert.date.formatted(date: .abbreviated, time: .shortened)).font(.footnote).foregroundStyle(.secondary)
                    if !store.error.isEmpty { Text(store.error).foregroundStyle(.red) }
                }.padding(24)
            }.safeAreaInset(edge: .bottom) {
                Button { Task { await store.acknowledge(alert) } } label: { Label(acknowledged ? "Acknowledged" : "Acknowledge message", systemImage: acknowledged ? "checkmark.circle.fill" : "checkmark.circle").frame(maxWidth: .infinity).padding(.vertical, 10) }
                    .buttonStyle(.borderedProminent).disabled(store.busy || acknowledged).padding(20).background(.regularMaterial)
            }.navigationTitle("Command-center alert").navigationBarTitleDisplayMode(.inline)
                .toolbar { ToolbarItem(placement: .topBarTrailing) { Button("Done") { dismiss() } } }
        }
    }
}
struct DutyView: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject private var location = DutyLocation.shared
    @State private var project = ""
    @State private var confirmEnd = false
    var body: some View {
        Form {
            Section {
                Label(store.state?.user.onDuty == true ? "On duty" : "Off duty", systemImage: location.sharing ? "location.fill" : "location.slash").font(.title2.bold())
                Text(location.status).foregroundStyle(.secondary)
                if let fix = location.lastFix {
                    Map { Marker("Your latest GPS fix", coordinate: fix.coordinate).tint(.teal) }.mapStyle(.standard).frame(height: 230).clipShape(RoundedRectangle(cornerRadius: 18))
                }
            }
            Section("Operation") {
                Picker("Project", selection: $project) {
                    Text("General duty").tag("")
                    ForEach((store.state?.projects ?? []).filter { $0.status != "completed" }) { Text($0.name).tag($0.id) }
                }.disabled(store.state?.user.onDuty == true)
            }
            Section {
                if store.state?.user.onDuty == true || location.sharing {
                    Button("End duty", role: .destructive) { confirmEnd = true }
                    if !location.sharing { Button("Resume location sharing") { Task { await store.run { try await location.begin(projectID: store.state?.user.dutyProjectId); await store.refresh() } } } }
                } else { Button("Start duty", systemImage: "location.fill") { Task { await store.run { try await location.begin(projectID: project.isEmpty ? nil : project); await store.refresh() } } }.fontWeight(.semibold) }
            }.disabled(store.busy)
            if !store.error.isEmpty { Section { Text(store.error).foregroundStyle(.red) } }
            Section("Your privacy") { Text("During duty, approved operators can see your preferred name and current position. End duty stops GPS uploads and removes the shared point when the service is reachable. iOS may pause location after force-quit or when permissions are restricted.").font(.footnote).foregroundStyle(.secondary) }
        }.navigationTitle("Duty")
            .confirmationDialog("End duty and stop sharing your position?", isPresented: $confirmEnd, titleVisibility: .visible) {
                Button("End duty", role: .destructive) { Task { await store.run { try await location.end(); await store.refresh() } } }
            }
    }
}
struct AccountView: View {
    @EnvironmentObject private var store: AppStore
    @ObservedObject private var push = PushCoordinator.shared
    var body: some View {
        Form {
            Section { Label(store.state?.user.name ?? "", systemImage: "person.crop.circle.fill").font(.title2.bold()); Text("@" + (store.state?.user.username ?? "")).foregroundStyle(.secondary) }
            if !store.recoveryCode.isEmpty {
                Section("Save your recovery code") { Text(store.recoveryCode).font(.system(.body, design: .monospaced)).textSelection(.enabled); Text("This is shown only after registration. Keep it private; it can reset your password.").font(.footnote) }
            }
            Section("Notifications & Dynamic Island") {
                Label(push.status, systemImage: "bell.badge")
                Button("Set up notifications") { Task { await push.enable() } }
                Button("Open iPhone settings") { if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) } }
                Text("Expand a notification to read the message or acknowledge it without opening the app. Active urgent alerts can also appear in Dynamic Island and on the Lock Screen.").font(.footnote).foregroundStyle(.secondary)
            }
            Section("Sound") { Text("iOS controls notification sound. Critical Alerts can sound through Silent Mode and Focus only after Apple approves TANOVIQ and you grant permission. Dismissing a notification does not forcibly stop a system sound already playing.").font(.footnote).foregroundStyle(.secondary) }
            #if DEBUG
            Section("Local developer preview") { Button("Preview Dynamic Island · no alert sent") { push.previewLiveActivity() } }
            #endif
            Section { Button("Sign out", role: .destructive) { Task { await store.signOut() } }.disabled(store.busy) }
            if !store.error.isEmpty { Section { Text(store.error).foregroundStyle(.red) } }
        }.navigationTitle("Account")
    }
}
struct PriorityLabel: View {
    let priority: String
    var body: some View {
        Label(priority.capitalized + " alert", systemImage: priority == "normal" ? "bell" : "exclamationmark.shield.fill")
            .font(.subheadline.weight(.semibold)).foregroundStyle(priority == "critical" ? Color.red : priority == "high" ? Color.orange : Color.teal)
    }
}
private extension View {
    func card() -> some View { padding(20).frame(maxWidth: .infinity, alignment: .leading).background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 24, style: .continuous)) }
}
/// Native controls adopt iOS 27's refined Liquid Glass and the user's tint slider.
/// Important text uses solid system content surfaces; glass is limited to navigation.
private struct NativeGlassControl: ViewModifier {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *), !reduceTransparency { content.glassEffect(.regular.interactive(), in: .capsule) }
        else { content.background(Color(uiColor: .secondarySystemGroupedBackground), in: Capsule()) }
    }
}
