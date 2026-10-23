# TANOVIQ Android pilot 0.4.1

An installable Android app (Android 8+) for the existing personnel service.
The public interface loads from `https://ews-kappa.vercel.app/#/public` in an
origin-restricted WebView. Native code handles alarms, notification permissions,
Firebase Cloud Messaging, safe external links, Android back navigation, and
location permission. Accounts and consented locations use the existing Render
API through the same HTTPS origin. No separate account system is introduced.

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
