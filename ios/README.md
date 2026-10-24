# TANOVIQ for iPhone — source preview 0.1.0

This is native SwiftUI iPhone source, **not a signed IPA or a TestFlight release**.
It has not been compiled with Xcode or tested on an iPhone. The host used to
prepare it is Windows; no Apple Developer membership or macOS builder is connected.

## Design and behavior

- Build with **Xcode 27 / iOS 27 SDK** for Apple's refined Liquid Glass appearance.
  Native TabView, NavigationStack, toolbars, forms and sheets adopt the current
  platform styling. A single duty control uses regular Liquid Glass on iOS 26+;
  emergency message surfaces stay opaque and readable. System tint preferences,
  light/dark mode, Dynamic Type and Reduce Transparency are respected. Minimum
  deployment target is iOS 17.2, with standard controls on older releases.
- Four native tabs: Overview, Alerts, Duty and Account. Registration/sign-in use
  the same command-center accounts, preferred names and recipient-scoped inbox.
  There is no mobile button that grants or opens command-center access.
- The TANOVIQ logo is included for launch, app icon and initial loading. The
  approved dark variant from `desktop/assets` is reused; no new logo was invented.
- Ordinary APNs **visible** notifications carry the message and category actions.
  Delivery does not depend on a suspended app fetching its inbox. Expand/hold a
  notification to read and acknowledge; acknowledgment requires unlocking and
  runs without foregrounding the app. It updates the existing receipt endpoint.
  A failed acknowledgment is explicitly reported rather than marked successful.
- Urgent alerts can start a Live Activity remotely on iOS 17.2+ using Apple's
  push-to-start token. Compact/minimal/expanded Dynamic Island and Lock Screen
  views show priority, text, freshness and an authenticated Acknowledge action.
  Phones without Dynamic Island still get the Lock Screen view and notifications.
  Display is controlled by iOS and the user's Live Activities setting.
- Start duty requests location permissions and obtains the existing restricted
  location token. Native Core Location sends fresh fixes without a WebView and
  shows the background location indicator. End duty immediately stops uploads,
  then revokes the token and removes the point; offline removal is retained for
  retry. GPS cadence is determined by iOS, not guaranteed once per second.
- Session/location credentials stay in this app's Keychain. No APNs private
  key belongs in the app. HTTPS requests do not follow redirects.

## Sound: what iOS permits

Normal notifications obey iPhone sound settings. High/Critical messages request
time-sensitive presentation by default. To use Critical Alerts, Apple must first
approve TANOVIQ's restricted entitlement, the signing profile must include it,
and the person must grant Critical Alerts permission. Until those steps are
complete, the entitlement and authorization request are deliberately disabled.
The backend also requires both its approval flag and the device permission flag
before setting a critical sound at volume 1.

Dynamic Island is a status surface, not a background siren. This source uses
system notification sounds; it does not promise an indefinitely looping alarm.
The iOS **Dismiss alert** action removes the notification/Live Activity without
acknowledging it. iOS does not provide an API here to forcibly stop an APNs sound
that is already playing. The Android-specific Silence alarm control is separate.

## Build on a Mac

Install Xcode 27 and its iOS simulator runtime, accept its license, and install
[XcodeGen](https://github.com/yonaskolb/XcodeGen). From this directory:

```sh
xcodegen generate
xcodebuild -project TANOVIQ.xcodeproj -scheme TANOVIQ -configuration Debug \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Open the generated project, choose an available iPhone simulator, and run the
`TANOVIQ` scheme. Run `TANOVIQTests` as well. Sign-in and inbox use the existing
production service; use a dedicated test account and no real emergency broadcast.
For notification visual testing, copy `Fixtures/alert.apns`, replace its `userId`
with your isolated test account ID, then use `xcrun simctl push booted
ph.tanoviq.app /path/to/your-test.apns`. This is a local sample; its acknowledgment
will fail unless the ID refers to an actual message in that account's inbox.
The Debug Account screen also offers a clearly labeled local Live Activity
preview. Actual remote push-to-start delivery requires APNs credentials and a
signed device build.

## Enable Apple push on the existing Render service

Deploy the repository's additive server/schema changes, then set server-only:

| Variable | Value |
| --- | --- |
| `APNS_TEAM_ID` | Your Apple team ID |
| `APNS_KEY_ID` | Your APNs signing key ID |
| `APNS_PRIVATE_KEY` | Contents of the Apple `.p8` key; keep secret |
| `APNS_BUNDLE_ID` | `ph.tanoviq.app`, or your registered matching bundle ID |
| `APNS_CRITICAL_ALERTS_APPROVED` | `false` until Apple's approval is in place |

No Apple key has been created or uploaded. APNs is inactive when configuration
is absent; existing Android/web notifications continue working. `/api/config`
reports `iosPushReady` only when provider configuration is available. A registered
token and a real-device test are still needed to verify delivery.

`/push/ios` binds tokens to authenticated, unexpired sessions. Activity tokens are
bound to a device and an actual alert recipient. Logout/recovery cascades revoke
these records. APNs acceptance is not a receipt or proof of audible output.

After Apple grants Critical Alerts, add
`com.apple.developer.usernotifications.critical-alerts: true` to the app's
entitlements in `project.yml`, set `TANOVIQCriticalAlertsApproved: true`, regenerate
the project, use the updated provisioning profile, then enable the Render flag.
Never enable these based solely on a local sound test.

## TestFlight steps still required

1. Enroll in the Apple Developer Program and get access to a Mac or macOS builder.
2. Register `ph.tanoviq.app` with Push Notifications and Time Sensitive
   Notifications, plus extension `ph.tanoviq.app.alerts`. Select your team in Xcode
   for both targets; reserve the identifiers in your own account.
3. Create the App Store Connect app. Check the privacy manifest against the final
   service, complete App Privacy, export compliance and beta review information,
   and supply your organization's privacy-policy/support URLs.
4. Build, run and fix any SDK/compiler diagnostics. Test light/dark mode, largest
   Dynamic Type, Reduce Transparency, iOS 27's glass tint preferences, notification
   actions and Dynamic Island on a real device.
5. Archive a Release build for Any iOS Device, validate, and upload from Xcode's
   Organizer to App Store Connect. TestFlight uses production APNs; Debug uses
   sandbox APNs. Increment the build number for each upload.
6. Invite testers through TestFlight. External testing can require beta review.

No TestFlight invitation, Apple approval or physical-phone test is claimed by
this source package. Do not treat it as an operational emergency system release.

## Physical acceptance tests

Use an isolated recipient and messages prefixed **TEST ONLY — NO EMERGENCY**.
Check app foreground/background, locked screen, fresh and expired sign-in,
notification permission denied, disabled Live Activities, offline/reconnect,
silent mode/Focus with and without approved Critical Alerts, acknowledgment from
the notification and Dynamic Island, and duty location while locked. Confirm that
sign-out ends activities and old-account actions cannot acknowledge another inbox.
Force-quit, offline/powered-off devices and OS restrictions can prevent delivery.

References: [iOS 27 platform guidance](https://developer.apple.com/ios/whats-new),
[Materials](https://developer.apple.com/design/human-interface-guidelines/materials),
[Live Activities push](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications),
[Critical Alerts](https://developer.apple.com/documentation/bundleresources/entitlements/com.apple.developer.usernotifications.critical-alerts),
[TestFlight](https://developer.apple.com/testflight/).
