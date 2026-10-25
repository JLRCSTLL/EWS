# Command center 1.1

The Windows client and local browser share the same command-center UI. The
installed client loads `https://ews-kappa.vercel.app/`; an installer update alone
does not publish frontend or API changes.

## Groups

Use **Groups → Create group**, enter a name and tag, and optionally choose a
primary leader. **Add members** selects registered personnel by preferred name.
The member list can assign additional leaders. Approved operators and admins can
manage groups; personnel cannot grant themselves command-center access. A leader
assignment does not change the person's access role. Existing project/task records
remain under **Existing operation assignments**, within Groups.

**Message group** opens the existing recipient review flow. Group targeting includes
members regardless of geofence or duty status. No broadcast is sent just by
creating a group or assigning a leader.

## Place boundaries

Type a barangay, city/municipality, or province in the oval map search and press
Enter. Include the municipality/province when a name is ambiguous. A single result
opens its boundary; otherwise select a result beneath the search field. Search
does not open a modal. Rename the preview if needed and select **Save geofence**.
Search again to add another area. All saved boundaries remain on the map and in
the saved-area selector; there is no fixed number-of-geofences limit. Storage is
local to this browser/desktop profile and limited by its available browser storage.
The app reports a storage failure instead of claiming a successful save.

Data source: [GEODATA Philippine Administrative Boundaries](https://services7.arcgis.com/poQdgvLD6DHnbpsT/arcgis/rest/services/Philippine_Administrative_Boundaries/FeatureServer).
These are indicative boundaries derived from the provider's 2015/2020 source
data, not a guarantee of current legal boundaries. The UI shows source attribution
and asks operators to confirm local changes. Complex coastlines may be simplified;
the preview identifies increased tolerance. Polygon holes and separate islands
remain distinct during rendering and server-side recipient matching. No location
or personnel information is sent to the boundary provider; only entered place names.

## Desktop notifications

The bell opens recent connected field requests, safe check-ins, and broadcasts.
Its badge counts unread events. Opening an item navigates to its relevant workspace
and marks that desktop event read. **Mark all read** persists on the current
workstation and account. It never acknowledges a personnel alert or silences a
phone alarm. Service reconnection uses the existing live event stream and refresh
fallback. No fake activity is added to the live bell.

## Deployment order

1. Deploy the API/schema. `/api/config` must report `groupManagementReady: true`,
   `boundaryGeofencesReady: true`, and `commandCenterVersion: "1.1.0"`.
2. Publish the frontend to the existing Vercel production project.
3. Reload the Windows client and mobile web interface. The Android pilot 0.5.1
   retains the previous native notification/location improvements and signing key.

Windows packages are unsigned evaluation builds. Android is the existing
debug-signed pilot (`ph.eligtas.app.pilot`), not a Play Store release. Physical
phone audio and background behavior require a real-device check. No live emergency
broadcasts are needed for the automated tests.
