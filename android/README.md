# Mobile Phone Android pilot 0.7.0

An installable Android app (Android 8+) for the existing personnel service.
The public interface loads from `https://ews-kappa.vercel.app/#/public` in an
origin-restricted WebView. Native code handles alarms, notification permissions,
Firebase Cloud Messaging, safe external links, Android back navigation, and
location permission. Accounts and consented locations use the existing Render
API through the same HTTPS origin. No separate account system is introduced.

Pilot 0.7.0 (version code 9) adds custom alert audio and the Mobile Phone display
name. It retains the notification/location improvements below
and the existing pilot signing identity. Its hosted interface uses the same Groups
and command-center 1.1 service. Publishing web/API changes is separate from APK
installation; see the [deployment guide](../README.md#deployment).

## Mobile design

The hosted interface adopts an iOS 27-inspired layout: large headings, floating
glass navigation, rounded action controls, grouped settings, and solid, readable
alert cards. **Account → Glass appearance** adjusts the navigation tint and saves
the preference on the current device. Controls respect reduced-motion and
reduced-transparency settings, have visible focus states, and keep the Android
back-navigation behavior. No Apple fonts or native Apple frameworks are bundled.

The cached notification message and offline/retry screens also use the new teal
palette, rounded controls and larger text. These native changes require installing
the 0.7.0 APK. The alarm, location, permissions and acknowledgment policies below
are unchanged. Physical-phone verification is still needed after installation.

Design references: [iOS 27](https://www.apple.com/os/ios/) and
[Apple's materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials).

## Native notification behavior

The message, expanded text and **Silence alarm** action now share one notification,
including during native alarm playback. Silence targets that alert only, works
offline without opening the app, and never acknowledges the message. An older
notification cannot stop a newer alarm. The text remains after playback ends.

**Read message** opens a native, cached message view immediately, without waiting
for the web inbox. Its explicit **Acknowledge message** action queues a receipt
with Android WorkManager; the UI says it is queued until it can be sent. A signed-in
background worker fetches the full text, so long messages use their complete inbox
content once online. Android's lock-screen preview policy remains in effect.

Rotated Firebase tokens register with the existing authenticated session in a
retryable background worker instead of waiting for the WebView to open. Receipts
also sync from push delivery; they do not claim physical sound verification.
Worker inputs contain operation/alert/account IDs, never session credentials.
Expired sign-in still requires signing in again, and force-stop/manufacturer
battery restrictions can still prevent or delay FCM delivery.

The APK includes these Android changes and can use the current server endpoints.
No Apple setup or iOS backend deployment is needed to install this Android update.

## Build and install

Requirements: JDK 17, Android SDK platform 36, and an internet connection.

```powershell
npm ci
npm run build
cd android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

The installable pilot is `app/build/outputs/apk/debug/app-debug.apk`, package
`ph.eligtas.app.pilot`. Transfer it to a test phone and open it to install. Android
will ask the user to allow installation from that file source. The pilot is
debug-signed and is not a Google Play release. Use the same signing key for pilot
updates; uninstalling removes local settings and sign-in.

For a production release, register `ph.eligtas.app` in Firebase, provide release
signing through `ELIGTAS_KEYSTORE`, `ELIGTAS_STORE_PASSWORD`, `ELIGTAS_KEY_ALIAS`,
and `ELIGTAS_KEY_PASSWORD`, and run `:app:bundleRelease`. Keep the keystore and
passwords outside Git and back them up securely. Store review, privacy disclosures,
and real-device delivery verification remain separate release steps.

## Connect background notifications

1. In the Firebase project `e-ligtas-4e8ce`, register an Android
   app with package `ph.eligtas.app.pilot`. Download its `google-services.json`
   into `android/app/`. This local configuration is Git-ignored. Rebuild the APK.
2. Enable Firebase Cloud Messaging HTTP v1. Configure a service account with only
   the permissions required to send FCM messages. Put its JSON in the **Render
   server-only** environment variable `FCM_SERVICE_ACCOUNT_JSON`. Never place the
   private key in the Android app, Vercel frontend variables, or source control.
3. Redeploy Render. `/api/config` reports `androidPushReady: true` only when the
   server configuration is present. A valid device token and an actual device
   test are still required to confirm delivery.
4. Open the installed app, sign in, open **Account**, enable Android notifications,
   and confirm **Background notifications connected**. This associates the FCM
   token with the authenticated session. Logout/recovery revokes that binding;
   push delivery queries actual geofence recipients and unexpired sessions only.

Without Firebase configuration, the app remains usable online and shows that
background push is unavailable. It does not claim to have registered a device.

## Alarm behavior

An operator can attach an alarm sound or voice recording of up to 30 seconds.
For High/Critical alerts, the ordinary alarm starts immediately while the app
downloads the authorized attachment. Voice plays once; an alarm clip repeats
within the bounded alarm session. Failed downloads or playback retain the
ordinary alarm. Silence invalidates pending downloads as well as current
playback. Normal announcements have manual playback in the web inbox.

This requires the 0.7.0 APK and a backend reporting `alertAudioReady: true`.
Audio is fetched from the existing HTTPS service with the current account's
session, never an arbitrary URL supplied in a push. Clips are limited in size,
cached privately for playback, and deleted when the alarm ends. Test custom
audio separately on a physical phone before operational use.

- High/critical emergency alarms are always enabled at full alarm volume after
  sign-in. There is no alarm-off or volume toggle in the personnel app.
- Browser/PWA audio requires a gesture for each visit and plays while the page is
  open. Websites cannot force hardware volume or override silent mode.
- Android high/critical alerts use the alarm audio stream, up to 30 seconds, with
  vibration and a notification-tray **Silence alarm** button. Normal announcements
  use ordinary notifications in the background, respecting device settings.
- Playback rises gradually to full alarm volume and restores the previous volume
  afterward unless it was changed during playback. Test alarm uses the same policy.
- Open **Allow Do Not Disturb access**, grant the OS permission, then review the
  emergency notification channel. Allow alarms and that channel in Android's DND
  settings. The app never disables DND globally. Total-silence modes, blocked
  notifications, device policies, headphones, battery restrictions, force-stop,
  no network, and a powered-off phone can still prevent or delay sound.
- Duplicate deliveries, stale alerts older than five minutes, and another
  account's alerts are rejected before alarm playback. Silencing does not mark
  an alert as read. Read acknowledgment remains an explicit inbox action.

The command center defaults to **High · emergency alarm**. **Critical** also
requests an alarm; **Normal · announcement** uses ordinary notification sound.
Both emergency priorities use high-priority FCM data messages. A high-priority
FCM delivery can start the alarm foreground service. If Android downgrades or
blocks that delivery, a channel notification is used and the phone records the
reason in **Account → Last alert on this phone**.

Pilot 0.3.0 suppresses a competing notification sound when its alarm service starts.
Transient audio-focus loss pauses the player; it resumes when focus returns,
within the original 30-second limit. Permanent focus loss stops playback.
Playback diagnostics distinguish starting, playing, paused and blocked states;
“started” is not a guarantee of physical sound output. The app shows the current
DND alarm policy separately from the emergency notification channel exception.

If **Test alarm** works in silent mode but command-center messages do not, first
check that the message was High or Critical and that **Background notifications
connected** appears in Account. Check the last-alert status. If nothing arrived
until reopening the app, review the phone's background-activity and battery
settings. Do not send a real emergency broadcast for a sound test.

## Live location in the command center

On first sign-in, follow the location, background location, notification and
DND permission walkthrough. Android 11+ requires choosing **Allow all the time**
in system settings. Declining leaves the inbox available. Tap **Start duty**
while the app is open to start tracking; permission alone does not start it.
The foreground service shows a persistent **End duty** notification. It requests fresh GPS fixes every
second and uploads the newest fix without waiting for the WebView, including
when the screen is locked or another app is open. Precise location gives the
best accuracy. GPS, connectivity, battery restrictions, force-stop and device
policies can delay or stop updates; a one-second interval is a target.

Approved operators receive a server event for each saved update and refresh the
map automatically. A five-second refresh remains as a reconnect/proxy fallback.
Markers retain their identity and open popups while their positions change.
Green **Live** labels mean a fix within 30 seconds; older positions say **Last
seen** and keep their original timestamp. Cached fixes are not relabeled as live.

The service uses a location-only credential tied to the signed-in session; it
cannot read residents, send alerts, or grant operator access. Only one native
sharing device is active per account. End duty removes the point and revokes
queued uploads. Offline stops keep a pending removal for the next connection;
the command center shows the previous fix as stale until removal reaches it.
Logout/recovery invalidates the sharing credential. Force-stopped apps must be
opened and duty location resumed again. No boot receiver is used.

Deploy the Render API and confirm `/api/config` reports
`nativeLocationReady: true`, `gsamReady: true`, and `dutyTracking: true` before
installing the updated pilot. Location sharing
does not require Firebase; background alert delivery does.

## Verify on a physical Android phone

Use a dedicated test account. Start duty and share its location, draw a geofence around it in
the connected command center, and send **TEST ONLY — no emergency** to that
resident only. Check foreground, background, locked screen, silent ringer, and
DND with and without alarm exceptions. Confirm volume restoration, stop button,
deduplication, logout, and the command center's received/read counters. FCM
acceptance alone is not proof that a phone rang; physical sound is not verified
by unit tests or a successful APK build.

Reference: [Android notification channels](https://developer.android.com/develop/ui/views/notifications/channels),
[FCM Android delivery](https://firebase.google.com/docs/cloud-messaging/android/receive-messages),
[background service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start).

## Responder update 0.8.0

The responder workspace opens assigned navigation automatically while the app is active. Dispatch notifications include **Open navigation**. Incident chat supports a single image chosen through Android’s system document picker; no broad storage permission is requested. Install the new pilot for that picker and notification action. See [the responder workflow](../docs/responder-dispatch.md).
