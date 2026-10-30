# Responder dispatch

This pilot connects the command-center **Dispatch** desk to the mobile **Responder workspace**. It uses registered accounts and database records, independently of the presentation demo.

## Operator workflow

1. Open **Dispatch → Directory** and save the response base and any locally verified receiving hospitals. Pin the entrance/access point and provide a clear name.
2. Select **Record emergency call**. Enter the requested service, priority, relevant notes and exact emergency location. An existing assistance request can be selected as the source.
3. Record validation findings and choose **Confirm emergency** or **Reject report**. Unvalidated reports cannot be assigned.
4. Choose an on-duty registered responder, unit call sign and return base, then **Assign & send navigation**. Only that responder receives the dispatch alert. A responder can have one active dispatch at a time.
5. Follow status changes, locate the unit using its shared duty position, and use **Private chat** for incident updates and photos. Operators may advance the next valid stage when the driver reports by radio.

Reassignment is available before departure. It immediately revokes the previous responder's access to the case, chat, routes and photos. Closed cases remain in History. Cancelled dispatches stop active navigation.

## Driver workflow

Sign in and start duty. New assignments open the responder map automatically while the mobile app is active. In the background, the operating system displays the dispatch notification; **Open navigation** opens the assigned route when tapped on Android. The app does not force itself over other apps.

The navigation screen uses colored satellite or street imagery, a highlighted road route, next maneuver, estimated remaining distance/time, and the duty GPS position. The stages are:

**Assigned → En route → On scene → Transporting to hospital → At hospital → Returning to base → Completed**

After arrival on scene, open **Chat**, attach a selected JPEG/PNG/WebP photo, review the preview, and send it with the relevant update. This does not automatically change transport status.

Choose **Navigate to hospital**, review nearby mapped hospitals, confirm receiving capability with dispatch, and select a facility. This saves the destination, advances the transport stage, and activates its route. **Return to base** activates the saved base route. **Confirm back at base** completes the dispatch. Return without hospital transport is also available from the scene.

## Navigation limits and data providers

- Road routing uses OSRM's driving profile. Route geometry is never replaced by an invented straight-line route when routing fails. A navigation-app link remains available.
- Travel time is an estimate without live traffic, emergency-vehicle privileges, flooded-road closures, or verified road accessibility. It is not a guarantee of safe passage.
- Nearby hospitals are mapped facilities from OpenStreetMap/Overpass plus the operator directory. Results are sorted by straight-line distance to the emergency, not clinical suitability, availability, admission capacity, or driving time. Dispatch must confirm the receiving facility.
- A recent duty position (under two minutes, accuracy within 250 m) is used as the origin. Otherwise the previous leg's known start/base is shown explicitly. Missing GPS is not presented as a live position.
- The routing service receives origin and destination coordinates. Overpass receives an approximately 0.01-degree search location; map providers receive tile requests. Patient information and chat/photo contents are not sent to mapping providers.
- Public routing and map services have no operational availability guarantee. Configure an appropriate supported/self-hosted routing service before field deployment.

## Incident privacy

Only approved operators and the currently assigned responder can read an incident or its chat. Photo endpoints require the current signed-in session and return a no-store cache policy. Notifications contain a generic assignment notice, without clinical notes or precise coordinates.

The client reduces selected photos; the server verifies the decoded image, rejects unsupported formats, bounds pixel count/file size, re-encodes JPEG, and removes EXIF/GPS metadata. Up to 40 photos are accepted per incident. Photo access expires after seven days; expired bytes are removed when subsequent chat messages are saved. Text/incident records remain in the database. This is not an end-to-end encrypted medical-record system. Do not treat the pilot as a clinical records repository.

Assignment, validation and status changes are audited without clinical text or coordinates. Registered personnel names remain preferred names; contact visibility rules are unchanged.

## Deployment and verification

Deploy both the Node 24 API and frontend. The API applies the additive response tables and advertises responderReady with version 1.2.0 from /api/config. The frontend shows an update notice against an older service.

Android **0.8.0-pilot (10)** adds the system photo picker and dispatch notification action. Install over the previous pilot with the same signing key. Existing duty-GPS and alarm permissions still apply. iPhone **0.2.0** adds a Respond tab with an isolated authenticated WebKit map/chat, backed by the existing native duty-GPS and APNs integrations. A signed iPhone build still requires Apple signing and distribution setup.

Automated tests cover validation, authorization, one active assignment per driver, stale updates, reassignment revocation, scoped notifications, hospital/return routing, private photos, expiry, metadata stripping, and chat pagination. Native Android notification behavior is tested with Robolectric. Verify GPS movement, background notification delivery, selected-photo upload and audible alerts on a physical phone before using the pilot in the field.
