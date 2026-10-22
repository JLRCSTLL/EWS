# E-Ligtas Android pilot

An installable Android app (Android 8+) for the existing E-Ligtas public service.
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

1. In the Firebase project **E-Ligtas** (`e-ligtas-4e8ce`), register an Android
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

- **Enable sound** is an explicit choice, off initially and reset on account change.
- Browser/PWA audio requires a gesture for each visit and plays while the page is
  open. Websites cannot force hardware volume or override silent mode.
- Android high/critical alerts use the alarm audio stream, up to 30 seconds, with
  vibration and a notification-tray **Silence alarm** button. Normal announcements
  use ordinary notifications in the background, respecting device settings.
- **Use full alarm volume** is a separate opt-in for high/critical alerts. Playback
  rises gradually and restores the previous alarm volume afterward, unless the
  user changes it while the alarm plays. Test alarm uses the same preference.
- Open **Allow Do Not Disturb access**, grant the OS permission, then review the
  emergency notification channel. Allow alarms and that channel in Android's DND
  settings. The app never disables DND globally. Total-silence modes, blocked
  notifications, device policies, headphones, battery restrictions, force-stop,
  no network, and a powered-off phone can still prevent or delay sound.
- Duplicate deliveries, stale alerts older than five minutes, and another
  account's alerts are rejected before alarm playback. Silencing does not mark
  an alert as read. Read acknowledgment remains an explicit inbox action.
- Location is shared only after permission and while the app is open. There is
  no background location permission or continuous background tracking.

## Verify on a physical Android phone

Use a dedicated test resident. Share its location, draw a geofence around it in
the connected command center, and send **TEST ONLY — no emergency** to that
resident only. Check foreground, background, locked screen, silent ringer, and
DND with and without alarm exceptions. Confirm volume restoration, stop button,
deduplication, logout, and the command center's received/read counters. FCM
acceptance alone is not proof that a phone rang; physical sound is not verified
by unit tests or a successful APK build.

Reference: [Android notification channels](https://developer.android.com/develop/ui/views/notifications/channels),
[FCM Android delivery](https://firebase.google.com/docs/cloud-messaging/android/receive-messages),
[background service restrictions](https://developer.android.com/develop/background-work/services/fgs/restrictions-bg-start).
