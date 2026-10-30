# Command Center Platform and Mobile Phone

**See Risk Before It Strikes.**

Tanaw + Vision + IQ. TANOVIQ is a thesis and pilot project for Philippine command
centers: a shared operations map, on-duty personnel locations, group or
geofence-targeted alerts, and a mobile inbox for the people receiving them.

This is an independent prototype. It is not an official eGovPH integration or a
certified emergency service. Demo incidents, CCTV clips and moving vehicles are
clearly separated from connected accounts and alerts.

| Client | Purpose | Current build |
| --- | --- | --- |
| [Command center](https://ews-kappa.vercel.app/) | Browser interface for approved operators | Web |
| [Mobile Phone](https://ews-kappa.vercel.app/#/public) | Register, receive alerts, share location while on duty, request help | Mobile web / PWA |
| [Windows](desktop/README.md) | Dedicated command-center window, splash and desktop controls | 1.1.3, x64 installer / portable |
| [Android](android/README.md) | Mobile interface with native notifications, alarm controls and on-duty GPS | 0.8.0 pilot, version code 10 |
| [iPhone](ios/README.md) | SwiftUI app, APNs and Live Activity implementation | Development; no signed IPA or TestFlight release |

Windows and Android load the hosted interface. Rebuilding an installer does not
publish web or API changes. Native code updates require installing the new package.

The personnel interface uses a floating glass navigation bar, rounded controls,
larger alert text, and solid message cards. **Account → Glass appearance** adjusts
navigation tint on that device. Reduced-motion and reduced-transparency preferences
are respected. This is an iOS 27-inspired design implemented for Android/web,
not Apple's native Liquid Glass renderer.

## What operators can do

- **Groups:** create a group with its own name and broadcast tag, add registered
  members, assign a primary leader or additional leaders, and archive groups.
  Optional parent groups support your own organization. Existing project/task
  records remain under **Groups → Existing operation assignments**.
- **Live Operations Map:** view consented on-duty locations, freshness and
  accuracy; locate shared phones; use colored satellite or street imagery.
- **Boundary search:** search any supported Philippine barangay, city/municipality
  or province in the oval header bar. Press Enter and select a result if the name
  is ambiguous. The actual boundary previews on the map without opening a modal.
- **Saved geofences:** save the preview, then search another location to add more.
  All saved areas stay on the map. There is no fixed geofence-count limit; available
  browser storage is the practical limit. Saves are local to that browser/desktop
  profile, not synchronized between operators. Storage failures are reported.
  Saved areas use solid teal outlines and explicit labels; the selected area is
  brighter, while unsaved previews use amber dashes. Searching an already-saved
  boundary selects it instead of creating a duplicate draft.
  Press **Escape**, click the empty map, select the same boundary again, or use
  **Clear selection** to leave an area without deleting it. **Layers** controls
  saved boundary and shared personnel visibility in connected operations.
- **Reviewed broadcasts:** inspect recipients before sending to a geofence or
  named groups. Group selection or a recognized message `#tag` reaches group
  members regardless of geofence or duty status. Overlapping memberships do not
  duplicate deliveries. The server recalculates the audience before dispatch.
- **Alert audio:** upload an alarm clip or record a voice message of up to 30
  seconds, preview it, then review and send it with written instructions. Audio
  remains restricted to authorized operators and the actual alert recipients.
- **Desktop bell:** review actual field requests, safe check-ins and broadcasts.
  Opening an item goes to the relevant workspace. Read state belongs to the
  signed-in account on that workstation; it never acknowledges a phone alert.
- **Logs:** approved operators can search shared activity by event, preferred
  name, or record, filter by category/time, browse older entries, and export the
  displayed page as CSV. The latest page refreshes every 15 seconds. Broadcasts,
  group/operation changes, access decisions, and assistance status updates come
  from the server's audit records. Demo logs remain separate. Contact details,
  precise GPS positions, and message contents are excluded; record names reflect
  current labels. Deploy the API update to enable `/api/audit` on hosted clients.
- **Responder dispatch:** validate a call, assign an on-duty driver and base, activate
  mobile navigation, exchange private incident messages/photos, and follow scene,
  hospital transport and return-to-base stages. See [the responder guide](docs/responder-dispatch.md).

Operators and admins manage groups. Being a group leader does **not** grant
operator/admin access. New registrations begin as personnel accounts and require
approval before accessing command-center data.

See [the command-center 1.1 guide](docs/command-center-1.1.md) for detailed usage.

### Boundary data and population counts

Search uses [GEODATA Philippine Administrative Boundaries](https://services7.arcgis.com/poQdgvLD6DHnbpsT/arcgis/rest/services/Philippine_Administrative_Boundaries/FeatureServer).
The provider's indicative 2015/2020 source data may not reflect later administrative
changes. Search can return multiple places with the same name; include the
municipality/province to narrow results. Complex coastlines may be simplified,
with the tolerance disclosed in the preview. Separate islands and polygon holes
remain distinct in rendering and recipient matching. Confirm boundaries locally
before operational use.

Only the entered place query is sent to the boundary provider. Personnel records
and shared GPS coordinates are not sent with it. Map tiles require network access
and retain provider attribution; see [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

Population panels count registered app users with qualifying shared positions,
not census population. Location timestamps and reported accuracy matter: a marker
does not prove someone is still at that exact point. Demo counts use fictional
profiles and must not be presented as live field data.

## Run locally

Use Node.js 24 and npm. From the repository root:

```sh
npm ci
```

Start two terminals:

```sh
# Terminal 1: shared API and local database
npm run server

# Terminal 2: web interface
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [the local command center](http://127.0.0.1:5173/) or
[the local personnel app](http://127.0.0.1:5173/#/public). Vite proxies `/api` to
port 3001. Localhost on a phone refers to the phone, not your development computer.

With no `DATABASE_URL` and outside production mode, the server uses persistent
PGlite storage in Git-ignored `.local-data/`. It creates a local owner setup key
at `.local-data/owner-setup.key`. Register an account, open **Personnel → Account
owner setup**, and use that key once. Treat it as a secret.

The server reads process environment variables; it does not automatically load
`.env.example`. That file documents the required settings. Production requires
Postgres and refuses ephemeral storage.

To serve a built frontend and API together:

```sh
npm run build
npm start
```

## Build and verify

```sh
npm test
npm run build
npm run desktop:install
npm run desktop:test
npm run desktop:package
```

Windows packages are written to `desktop/release/`. They are unsigned evaluation
builds. Android requires JDK 17, Android SDK 36 and local Firebase configuration:

```powershell
cd android
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:lintDebug
```

The Android pilot is debug-signed with package `ph.eligtas.app.pilot`; use the
same signing key when updating an existing installation. See the platform READMEs
for permissions, signing, installation and device testing. Do not commit APKs,
installers, keystores, signing passwords or Apple credentials.

Automated API tests use isolated databases and mocked push delivery. They cover
authorization, group targeting, audience changes, boundary containment, location
revocation, contact privacy and notification receipts. They do not prove that a
physical phone rang, received GPS indoors or handled manufacturer battery limits.

## Connected mobile workflow

1. Register with a preferred name, username and a password of at least 12
   characters. Keep the one-time recovery code securely; recovery revokes old
   sessions.
   Registration on Android and the web includes optional phone/email, home
   province/city/barangay, age range, PWD status, assistance needs, and a trusted
   emergency contact. Only the account fields are required. Contacts are not
   verified and cannot be used for account recovery.
2. Grant the relevant OS location and notification permissions, then **Start
   duty** to share location. Permission alone never starts tracking. **End duty**
   stops uploads, revokes the location token and removes the map point.
3. A permitted operator selects a geofence or group, reviews the server-calculated
   audience, then sends an explicitly labeled test alert.
4. Receive and acknowledge the message. **Targeted** counts stored inbox entries;
   **Received** means the authenticated app fetched and acknowledged receipt;
   **Read** requires an explicit read acknowledgment. Provider acceptance does
   not count as device receipt.
5. Test a help request and safe check-in from the phone, and review them in the
   command center. End duty after the test.

Location events use a live stream with refresh/reconnection fallback. Position
frequency depends on the device, OS, permission, network and available GPS.
Browser location sharing requires the page to remain active; Android uses an
ongoing foreground service while on duty.

### Emergency-profile privacy

- Edit or remove optional details from **Account → Your profile**. Existing
  accounts and older clients continue to work without a profile migration form.
- Age range, PWD status, and assistance needs remain private unless the person
  explicitly enables sharing with approved command-center operators. Shared
  demographic selections also update geofence population and alert targeting.
  Disabling profile sharing removes that demographic targeting.
- Home area is profile information, not GPS. It does not start duty tracking or
  add a map marker, and is not returned in other users’ directory records.
- Emergency contacts require confirmation that the trusted person agreed to be
  listed. Their name/relationship and complete phone number are available only
  to the account holder or a specific admin with a current, user-approved
  `emergencyContact` visibility request. Approval expires after 24 hours.
- Changing contacts revokes pending and approved visibility requests. Audit
  logs contain no contact details, emergency-profile values, or exact locations.
- The backend applies additive user columns and an expanded contact-request
  constraint on startup. The interface checks `registrationProfileReady` before
  offering expanded registration. During a backend rollout, basic account
  creation and existing contact editing remain available; unsupported fields
  are not collected or submitted. Reload after deploying Render to see the
  expanded forms. New-form submissions recheck support to prevent silent data
  loss if the backend is rolled back.

On Android, high/critical alerts request the native emergency alarm. The expanded
notification includes message text, **Read message** and **Silence alarm**; the
native reader can display a cached alert without waiting for the web inbox.
Silencing stops only that alert and does not mark it read. Full-volume alarm
behavior still depends on OS permissions, DND policy and device restrictions.
Normal announcements use ordinary notifications. Web browsers cannot override
hardware silent mode. See [Android alarm behavior](android/README.md#alarm-behavior).

The iPhone implementation requires Apple signing, APNs configuration and device
validation. Critical Alerts require Apple's entitlement approval and user
permission. No store acceptance or TestFlight availability is implied.

### Custom alarm sound and voice

In **Compose alert → Alarm sound or voice**, choose a file purpose and upload an
audio file (up to 8 MB, 0.1–30 seconds), or select **Record voice** and grant
microphone access. Recordings stop automatically. Preview or remove the clip
before reviewing recipients. Written instructions are required even with audio.
Changing the attachment invalidates the previous audience review.

Android 0.7.0 plays attached audio for High/Critical alerts using the native alarm
service: alarm clips repeat for a bounded period; voice messages play once. The
ordinary alarm starts immediately and remains the fallback if downloading or
playing the attachment fails. Silence stops the current playback and restores
the previous alarm volume. Existing OS permission, DND and battery restrictions
still apply. Normal announcements offer manual playback in the inbox.

The mobile web inbox and operator delivery history include an audio player.
Automatic browser playback requires an open page and enabled browser audio.
iPhone source includes manual playback in alert details; background notifications
continue using the configured system sound. Arbitrary uploaded audio is not an
iPhone background alarm.

The server validates and stores normalized WAV bytes in Postgres, not public
files. Push messages carry only audio identifiers. Draft audio is private to its
author; sent audio requires an operator or recipient session. Unattached drafts
older than 24 hours are cleaned up on subsequent uploads. Deploy the API with
`alertAudioReady: true` before using these controls.

## Deployment

`render.yaml` defines the Node API and Postgres service.
`vercel.json` routes frontend `/api/*` requests to
`https://e-ligtas.onrender.com/api/*` before the SPA fallback.

1. Configure Render's server environment using `.env.example`. Keep
   `DATABASE_URL`, `BOOTSTRAP_TOKEN`, `FCM_SERVICE_ACCOUNT_JSON`, APNs private
   keys and push private keys server-only. Never use `VITE_*` for secrets.
2. Deploy the API/schema first. For this release, `/api/config` must report
   `groupManagementReady: true`, `boundaryGeofencesReady: true`,
   `registrationProfileReady: true`, `alertAudioReady: true`, and
   `commandCenterVersion: "1.1.3"`. Verify the deployed commit: deploying the
   latest commit of a stale branch does not deploy `main`.
3. Deploy the frontend to the existing Vercel `ews` project. Production uses
   `main`; a branch preview does not update the public domain. The
   `.vercelignore` file excludes local data, secrets and native app build trees.
4. Check `/api/health` on both hosts for JSON with `ok: true`. Signed-out
   `/api/state` must return JSON with HTTP 401. HTML at an API endpoint indicates
   a routing problem.
5. Bootstrap the initial owner once, then remove the production bootstrap token.
   Approve operator accounts through the authenticated application.
6. Reload installed clients and perform a controlled two-device test. Confirm
   actual location visibility and alert receipt before relying on the deployment.

Keep `ALLOWED_ORIGINS`, `PUBLIC_APP_URL`, the Vercel rewrite and native origin
allowlists aligned when changing hostnames. Evaluation hosting may sleep or have
storage/availability limits; review the selected plan before a continuing pilot.

## Privacy and repository security

Preferred names, live coordinates and alert history are still personal data.
Access is enforced by the API: personnel see their own records; operators see
authorized operational data. Optional email/phone fields are masked. An admin
requests specific fields with a reason; the person approves, declines or revokes
access. Approval is scoped to that requester, expires after 24 hours and is
revoked when contacts change.

Password hashes use salted scrypt. Session and recovery tokens are hashed on the
server. Local databases, environment files, Firebase service accounts and signing
material are excluded from Git. Public service URLs, Firebase project identifiers
and the VAPID **public** key are not server credentials.

The [25 October 2026 repository review](docs/security-review-2026-10-25.md) found
no credential leaks in the fetched Git history or source snapshot. GitHub secret
scanning and push protection were enabled with no open secret alerts. A
checksum-verified Gitleaks workflow now scans pushes and pull requests with
redacted output. This is a scoped check, not a guarantee that all security issues
have been excluded. See [SECURITY.md](SECURITY.md) for handling a suspected leak.

## Presentation mode

Select **Demo** in a web browser for the looping, automatic cursor walkthrough.
The Windows desktop client has no Demo or Demo data controls and always opens
connected operations, including when a demo query parameter is supplied. Demo alerts never send
external messages. Sample incidents, responder routes and CCTV footage are
simulated or prerecorded, not connected emergency feeds.

`/?demo=1#/public` opens the original same-browser personnel demonstration.
Its records use local storage and do not synchronize across separate phones,
browser profiles or origins. Use the normal `/#/public` route for connected
accounts and the shared backend.

## Source layout

| Path | Contents |
| --- | --- |
| `src/app/components/operations/` | Command center, groups, map, search and notification bell |
| `src/app/components/public/` | Personnel mobile web interface |
| `src/app/lib/` | Shared UI data, geometry, targeting and service client |
| `server/` | Authentication, API, schema, dispatch, location and push |
| `tests/` | API and shared-logic regression tests |
| `desktop/` | Windows Electron shell, splash, packaging and security tests |
| `android/` | Native Android wrapper, notifications, alarms and location |
| `ios/` | SwiftUI app, Live Activity extension and iPhone build setup |
| `docs/` | Operator guide and scoped security review |

The original interface attribution is retained in [ATTRIBUTIONS.md](ATTRIBUTIONS.md).

### Shared interface and presentation

The desktop interface is temporarily named **Command Center Platform**; the personnel app and demonstration phone are named **Mobile Phone**. Both use the charcoal glass material and typography in `src/styles/command-theme.css`. Mobile navigation remains sized for touch, and alert text uses a solid surface for readability. The emergency-profile registration form is shared by mobile and command-center account creation. Internal package identifiers and stored account sessions retain their existing names so installed updates remain compatible.

Select **Demo** in the web command center to start the automatic cursor walkthrough. Its 17 chapters cover emergency-profile sharing, groups and leaders, group announcements, map views, geofences, population and exposure, geographic alerts, the mobile app, ambulance dispatch, resident evacuation, responder routes, CCTV, and Logs. The presentation repeats automatically for display; each loop resets its sample data. Pause/resume and 1×/1.5×/2× playback are available. **Esc** or the close button exits and restores the original workspace.

The mobile chapters show a phone alongside simulated operator updates: read and acknowledge an alert, review the masked profile, share a sample duty position, send an assistance request, and receive a team assignment. In **Ambulance navigation**, the simulated dispatch opens a driving route to the emergency immediately on receipt. In **Resident evacuation**, an evacuation alert opens walking directions to the nearest available sample center, excluding closed or full centers. Both show a moving marker, turn guidance, remaining distance, and arrival; pause and playback speed apply to the journeys too. The chapter selector can jump directly to any scene.

Groups, profiles, messages, routes, shelter availability, and phone updates are in-memory fixtures. The demo never sends real alerts, plays alarms, requests device permissions, changes registered accounts, or dispatches a team. The embedded phone illustrates the proposed workflow; it is not a native iOS simulator, a real push-delivery test, or production emergency navigation. Desktop clients load the hosted interface, so removing the demo takes effect after the updated web deployment is loaded; no native installer update is required for this change.
