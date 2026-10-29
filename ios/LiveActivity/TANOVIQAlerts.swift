import SwiftUI
import WidgetKit
import ActivityKit

@main struct TANOVIQAlerts: WidgetBundle {
    var body: some Widget { AlertLiveActivity() }
}
struct AlertLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: TANOVIQAlertAttributes.self) { context in
            VStack(alignment: .leading, spacing: 12) {
                HStack { Label("Mobile Phone", systemImage: "dot.radiowaves.left.and.right").font(.caption.bold()); Spacer(); Text(context.state.priority.uppercased()).font(.caption.bold()).foregroundStyle(.orange) }
                Text(context.state.message).font(.headline).lineLimit(5)
                HStack {
                    Text(context.isStale ? "Last update · check inbox" : "Command-center alert").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button(intent: AcknowledgeAlertIntent(alertID: context.attributes.alertID, userID: context.attributes.userID)) { Text("Acknowledge") }.tint(.mint).buttonStyle(.bordered)
                }
            }.padding(16).activityBackgroundTint(Color(red: 0.08, green: 0.11, blue: 0.13)).activitySystemActionForegroundColor(.white).foregroundStyle(.white)
                .widgetURL(URL(string: "tanoviq://alert/" + context.attributes.alertID))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) { Label("Mobile Phone", systemImage: "antenna.radiowaves.left.and.right").font(.caption.bold()).foregroundStyle(.mint) }
                DynamicIslandExpandedRegion(.trailing) { Text(context.state.priority.uppercased()).font(.caption.bold()).foregroundStyle(.orange) }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 10) {
                        Text(context.state.message).font(.subheadline).lineLimit(4)
                        HStack {
                            Text(context.isStale ? "Update may be outdated" : "Active alert").font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Button(intent: AcknowledgeAlertIntent(alertID: context.attributes.alertID, userID: context.attributes.userID)) { Text("Acknowledge") }.tint(.mint).buttonStyle(.bordered)
                        }
                    }.padding(.top, 6)
                }
            } compactLeading: {
                Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.orange)
            } compactTrailing: {
                Text("ALERT").font(.caption2.bold()).foregroundStyle(.mint)
            } minimal: {
                Image(systemName: "exclamationmark.shield.fill").foregroundStyle(.orange)
            }.keylineTint(.mint).widgetURL(URL(string: "tanoviq://alert/" + context.attributes.alertID))
        }
    }
}
