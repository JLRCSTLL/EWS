
  # GSAM — Geospatial Situational Awareness Map

  This is a code bundle for Emergency Command Center Dashboard. The original project is available at https://www.figma.com/design/l6MkDSarJMxwwnrkzjzHvj/Emergency-Command-Center-Dashboard.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

## Connected public app (Render)

The Android pilot and build instructions are in [android/README.md](android/README.md).
The public app's **Account → Alert sound** enables audible incoming alerts while
open. Browser silent-mode and hardware-volume restrictions still apply. The
Android app adds always-enabled, full-volume high/critical emergency alarms;
background delivery requires Firebase configuration and device permissions.

The default `/#/public` route now uses registered accounts and the shared API.
Start **both** `npm run server` and `npm run dev` for local development. Node.js
24 is recommended. The server uses a persistent, git-ignored PGlite database
locally; production requires `DATABASE_URL` pointing to Postgres and refuses to
start with ephemeral storage. `npm run build && npm start` serves the complete app.
The local server creates `.local-data/owner-setup.key` for local owner activation;
this secret is ignored by Git and is never returned by the API.

- Residents register with a username and a password of at least 12 characters.
  Save the one-time recovery code; recovery rotates it and revokes old sessions.
  Passwords use salted scrypt; only hashed session and recovery tokens are stored.
- **Start duty** begins GPS sharing. **End duty** clears the map point and revokes
  native uploads. Android uses an ongoing foreground service while on duty; the
  browser must remain open. OS location permission alone never starts tracking.
- **Live data** in the command center shows only registered users and consented
  locations. All registrations start as residents. An approved operator can draw
  an area, inspect eligible users, select a group, and send a connected alert.
  The server recalculates the audience and stores the dispatch atomically.
- **Targeted** counts stored inbox entries. **Received** means the authenticated
  app fetched and acknowledged the message; **Read** requires the resident's
  acknowledgment. Push-provider acceptance is not counted as receipt.
- Inbox, location, assistance, and assignment changes refresh every five seconds
  while the page is visible and when it regains focus/connectivity. Failed writes
  show an error and are not silently reported as sent.
- Residents can see only their own data. Operator access is enforced by the API,
  including every dispatch and request transition. Owners approve access requests.
  Self-reported priority groups do not confer operator privileges.
- Install from the browser menu or **Add to Home Screen**. Enable device
  notifications in Account. iPhone web push requires a Home Screen installation
  and supported iOS/Safari. VAPID keys persist in the database. The service worker
  caches only an offline notice, never personal data or API responses.

### Deploy the shared service

1. Create a Render Blueprint from this repository using `render.yaml`. It creates
   the Node service and a Postgres database in Singapore, injects the internal
   connection string, and generates `BOOTSTRAP_TOKEN`. The web service serves both
   the app and `/api`, so the Render URL can be used directly from a phone.
2. The included **free** plans are for evaluation: Render free services sleep
   after inactivity and free Postgres expires after 30 days. Choose persistent
   paid capacity before ongoing real-world use; no paid plan is selected here.
3. The Vercel frontend at `https://ews-kappa.vercel.app` forwards `/api/:path*`
   to `https://e-ligtas.onrender.com/api/:path*` using the rewrite **before** the
   SPA fallback in `vercel.json`. The Render blueprint allows that frontend
   origin in `ALLOWED_ORIGINS`. If either hostname changes, update both settings.
   Do not expose the database URL, owner key, or VAPID private key to the browser.
4. Register your own account. In the command center choose **Personnel →
   Account owner setup**, then enter the generated `BOOTSTRAP_TOKEN` from Render's
   environment settings. This works once; afterward the owner approves requests
   from other registered accounts. Remove the bootstrap environment variable once
   the owner is activated.
5. On a second device, open the same HTTPS public URL, register, enable location
   sharing, and optionally select a priority group. Locate that user from the
   command center, draw an area around their real point, and send a clearly labeled
   test alert. Confirm both the inbox and the received/read counters. Test a help
   request and assignment, then end duty and verify the point disappears.

Production checks: `/api/health` on either host must return JSON with `ok: true`;
`/api/state` must return a JSON 401 when signed out. An HTML response means the
frontend is not connected to the backend. Vercel production deploys from `main`;
a successful preview on `ui/map-command-center` does not update the public site.

The deployment is a pilot for operational evaluation.
The original sample incident feeds, CCTV clips, and moving responder routes remain
available under **Demo data**, separately from the connected resident workflow.

## Map-led operations interface

The default screen is a responsive emergency operations view inspired by a dark,
map-focused command center, with a neutral gray palette, frosted glass panels,
silver accents, and satellite imagery in its natural colors. It includes satellite/street maps, incident filters,
selectable teams and facilities, priority alerts, operational summaries, and global
search (`Ctrl+K` / `Cmd+K`). The region selector switches between Metro Manila and
all sample regions. Search can locate results outside the current region.

Over the map, use the mouse wheel, a two-finger touchpad scroll, or a pinch gesture
to zoom. Drag to pan. The plus/minus controls and keyboard navigation also work.

The Incident priorities card summarizes critical, high, medium, and low incidents
for the selected region. **Review priorities** opens the incident center filtered
to critical and high severity, and clears any previous incident search.

Use **Workspace** to access the original configurable dashboard: layout presets,
draggable/resizable widgets, the widget library, geofence tools, and light mode.
Select **Live overview** under the E-Ligtas name to return to the new interface.
Broadcasts, delivery history, user roles, analytics, and audit logs remain available.

### Automatic presentation demo

Select **Demo** in the header to start an approximately two-minute walkthrough.
A visible cursor operates the real controls: it switches map views, draws and
names a geofence, reviews population and recipient groups, types an alert,
previews delivery, follows an ambulance, and opens a flood-monitoring camera.
No further clicks are needed. **Pause**, previous/next, restart, and **Esc** are
available to the presenter. Playback also pauses when the tab is hidden.

Presentation boundaries are temporary. Its delivery confirmation sends no
message and adds no history. Finishing or exiting restores the prior page,
map view, selected area, and unfinished boundary.

### Send an alert to a drawn area

1. Click a named geofence on the map, or select **Geofence** beside **Layers**.
   The demo starts with a rectangle in Manila, a circle in Quezon City, and a
   polygon in Marikina. Use the **+** beside Saved areas to draw another area.
2. Choose **Polygon** (at least three points), **Rectangle** (two opposite corners),
   or **Circle** (center and edge). Tap the map to add points. Drag handles to adjust
   the boundary, or use **Undo**. Keyboard users can pan the focused map with arrow
   keys and choose **Add center point**.
3. Enter a name and select **Save area**. The population card updates while drawing
   or editing a valid boundary. Select **Review recipients**, a population group,
   or **Send alert to this area**.
4. Choose one or more recipient groups, inspect the exposure map and recipient
   list, then write a message or choose a template and priority.
5. **Send demo alert** records the exact recipient IDs, targeting rules, location
   snapshot time, boundary coordinates, and an audit entry. History labels the
   result **SIMULATED**. No external notifications are sent.

Saved areas persist in this browser and can be selected, edited, renamed, or removed.
An area saved by the previous version is migrated alongside the demo areas. Polygon
boundaries that cross themselves and incomplete/zero-area shapes cannot be saved.
Alerts retain a snapshot of the boundary even if the saved area is edited later.
The **Population in geofence** card counts fictional registered app users whose
last shared position is inside the selected boundary, including boundary points.
It is not a census estimate or a guarantee that someone is still at that location.
The PWD, children, seniors, pregnant, and responder groups can overlap. Counts
include stale locations, which are separately identified; recipients follow the
stricter location and notification rules below.

### Group messaging and exposure visibility

The demo contains 240 deterministic fictional profiles in `src/app/lib/residents.ts`.
It does not read device location or contain real personal records. A snapshot is
created when the page loads; locations do not move or stream in real time.

- Active: shared within 5 minutes of the snapshot. Recent: up to 60 minutes.
  Older positions are stale and excluded from alerts.
- Active users only is enabled by default. Turn it off to include recent users.
- Notifications must be enabled. Missing/invalid locations are excluded, including
  when targeting all demo app users. The UI explains these exclusions.
- Multiple groups match **any** selected group; overlapping membership never
  duplicates a recipient. No matching recipients or no groups disables Send.
- The exposure map highlights eligible users and dims excluded positions in the
  selected area. Click a marker, or a recipient in the list, to see their location,
  age/group information, last update, and reported accuracy.
- **App users** on the main map toggles the selected area's shared positions.
  The geographic tests use longitude/latitude containment for polygons/rectangles
  and a great-circle distance for circles.

The original configurable Workspace retains its legacy sample targeting widgets.
Use the main map's Broadcast center for the new app-user targeting flow.

### Original public presentation demo

Visit `/?demo=1#/public` for the original same-browser presentation demo.
Use **Demo data** in the command center for this workflow. The header's Public app
link opens the connected version described above.
The responsive mobile web demo uses an eGovPH-inspired white-and-blue interface
with local alerts, acknowledgment, safe check-ins, assistance requests, nearby
sample facilities, and three selectable fictional resident profiles. It is an
independent integration concept, not an official eGovPH service or native app.

For a two-way presentation, keep both views open on the **same origin in the same
browser profile**:

1. In the command center, select **Marikina flood watch**, choose **PWD** or
   **All app users**, and send a clearly labeled demo alert. The public app defaults
   to Juan Dela Cruz (`demo-user-148`), an eligible Marikina resident.
2. Open the public **Alerts** inbox. Only delivered broadcasts whose saved
   recipient IDs include this resident appear. A separate sample advisory is
   always available and is labeled as a sample.
3. Acknowledge the alert, select **I'm safe**, or submit **Get help** with sample
   information. Including the fictional location is optional.
4. Open **Public inbox** in the command center to see the new records, locate the
   resident, acknowledge a request, assign a demo ambulance/rescue unit, or resolve
   it. Status updates appear immediately under **My status** in the public app.
5. Switch the presentation resident in **Account** to demonstrate geographic
   targeting. Requests allow one open request per resident; closed requests remain
   in their history.

This connection uses browser storage and storage events, with no server or real
notifications. Localhost and production do not share records; separate phones,
private windows, and different browser profiles do not synchronize. All profile
locations, facilities and response assignments are fictional. The nearby map's
dashed line is a straight-line illustration, not navigation or evacuation advice.

### Data and services

Operational records come from `src/app/lib/dashboard-data.ts`. They are sample
data, not a connected emergency feed. Broadcast delivery is simulated locally and
stored in browser local storage, as in the original project. The interface labels
this demo state. Connected-mode accounts and alerts instead use the Render API
and Postgres service documented above.

Satellite imagery uses Esri; the street map uses OpenStreetMap Standard. Both require
network access. Provider attribution remains visible, and a loading/failure message
appears when imagery cannot be loaded. See `ATTRIBUTIONS.md`.

### Build

```sh
npm ci
npm run dev
npm run server
npm run build
npm test
```

The geometry tests use Node.js 22.18 or newer for native TypeScript loading.

The production build is written to `dist/`. Existing Vercel configuration is retained.

## Custom operations and privacy

- **Structure** starts empty. Admins enter their own groups, reporting lines, heads,
  position titles, and classifications. These labels do not grant system access.
- **Projects** hold objectives, operational periods, leads, and task assignments.
  Assigned personnel can update their own task status. Completing a project ends
  its active duty sessions. The time range is a planning reference, not an automatic timer.
- **Named groups** and message `#tags` select members anywhere, regardless of duty
  or GPS, including active subgroups. Tags override geofence targeting. A server
  recipient preview is required and checked again at send time; changes require
  review. The final recipient set is frozen and overlapping memberships deduplicate.
- **Personnel** shows preferred names. Email/phone are optional and masked by the API.
  Admins request specific fields with a reason; the person approves, declines, or
  revokes access in Account. Approval lasts 24 hours, applies only to the requesting
  admin, and is revoked if contacts change. Legacy health groups are not displayed
  to other accounts.
- Admin/operator access is separate from group titles. Admins manage structure
  and grant operator access. Operators manage projects, inspect duty locations,
  and send reviewed alerts. Personnel only access their own records.

The additive schema migration preserves accounts, sessions and alert history.
It clears legacy off-duty locations and applies the personnel alert policy once.
Existing phones must start a new duty session. Deploy the Render backend first;
confirm `/api/config` reports `gsamReady` and `dutyTracking`, then deploy the web
frontend and install Android pilot 0.4.0 using the existing pilot signing key.
The Android package and backend schema identifiers remain unchanged for updates.

Run `npm test` for group delivery, audience changes/replays, contact privacy, access
control, native location revocation, and legacy migration regression checks.
Tests use isolated data and mocked push; they do not send emergency messages.
