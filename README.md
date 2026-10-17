
  # Emergency Command Center Dashboard

  This is a code bundle for Emergency Command Center Dashboard. The original project is available at https://www.figma.com/design/l6MkDSarJMxwwnrkzjzHvj/Emergency-Command-Center-Dashboard.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

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
   result **SIMULATED**. No public messages are sent.

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

### Connecting the mobile app later

This change implements the command-center demo and targeting logic. Production
mobile registration, location ingestion, authentication, and push delivery are
not connected. Replace the demo dataset with authorized app profiles and their
explicitly shared, timestamped positions and device notification registrations.
The service should validate geofences and group filters, calculate recipients
from current server data, authorize each operator, persist an immutable dispatch
record, and send through the mobile push provider. Use provider receipts for real
delivery status rather than the demo timer. Protect location/group access and
define location expiry and retention before using actual resident records.

### Data and services

Operational records come from `src/app/lib/dashboard-data.ts`. They are sample
data, not a connected emergency feed. Broadcast delivery is simulated locally and
stored in browser local storage, as in the original project. The interface labels
this demo state. No production service or authentication backend was added.

Satellite imagery uses Esri; the street map uses OpenStreetMap Standard. Both require
network access. Provider attribution remains visible, and a loading/failure message
appears when imagery cannot be loaded. See `ATTRIBUTIONS.md`.

### Build

```sh
npm ci
npm run dev
npm run build
node --test tests/*.test.mjs
```

The geometry tests use Node.js 22.18 or newer for native TypeScript loading.

The production build is written to `dist/`. Existing Vercel configuration is retained.
