
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

The Incident priorities card summarizes critical, high, medium, and low incidents
for the selected region. **Review priorities** opens the incident center filtered
to critical and high severity, and clears any previous incident search.

Use **Workspace** to access the original configurable dashboard: layout presets,
draggable/resizable widgets, the widget library, geofence tools, and light mode.
Select **Live overview** under the E-Ligtas name to return to the new interface.
Broadcasts, delivery history, user roles, analytics, and audit logs remain available.

### Send an alert to a drawn area

1. Select **Geofence** beside **Layers** on the main map.
2. Choose **Polygon** (at least three points), **Rectangle** (two opposite corners),
   or **Circle** (center and edge). Tap the map to add points. Drag handles to adjust
   the boundary, or use **Undo**. Keyboard users can pan the focused map with arrow
   keys and choose **Add center point**.
3. Select **Save area**, name it, then **Send alert to this area**.
4. Choose a message/template, recipient group, and priority. The composer selects
   the drawn area automatically; preset areas remain available.
5. **Send broadcast** records the alert, its boundary coordinates, and an audit entry.

The saved area persists in this browser and can be edited or removed. Polygon
boundaries that cross themselves and incomplete/zero-area shapes cannot be saved.
Alerts retain a snapshot of the boundary even if the saved area is edited later.
Custom-area recipient counts are not estimated without recipient location data.
Delivery remains a local simulation; no public alerts are sent.

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
node --test tests/geofencing.test.mjs
```

The geometry tests use Node.js 22.18 or newer for native TypeScript loading.

The production build is written to `dist/`. Existing Vercel configuration is retained.
