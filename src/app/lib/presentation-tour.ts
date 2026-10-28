import { demoGeofences } from './residents.ts';
import { mobilePresentationHelpNote } from './presentation-mobile.ts';

export const presentationArea = demoGeofences.find(area => area.id === 'demo-marikina')!;
export const presentationMessage = 'DEMO ALERT: Flood conditions are being monitored in your area. Prepare your emergency bag, follow local evacuation guidance, and request assistance if you need help reaching a safe location.';

export interface TourCue {
  target: string;
  label: string;
  duration: number;
  kind?: 'click' | 'type' | 'select' | 'map-point';
  value?: string;
  point?: { lat: number; lng: number };
}

export const presentationSteps: { id: string; label: string; title: string; description: string; cues: TourCue[] }[] = [
  { id: 'welcome', label: 'Welcome', title: 'Command Center Platform in action',
    description: 'Follow the cursor from the command center to the mobile app and back. This web presentation loops automatically with sample data. Press Esc to return to your workspace.',
    cues: [{ target: '.ops-brand', label: 'Your emergency command center', duration: 4000 }] },
  { id: 'profile', label: 'Emergency profile', title: 'Know how to help',
    description: 'Registration includes an optional emergency profile. People choose what to share, while contact information stays masked until access is approved.',
    cues: [
      { target: '[data-demo="nav-personnel"]', kind: 'click', label: 'Open sample personnel', duration: 1800 },
      { target: '[data-demo="profile-privacy"]', label: 'Use preferred names and masked contacts', duration: 2800 },
      { target: '[name="ageRange"]', kind: 'select', value: '60plus', label: 'Choose an age range', duration: 1800 },
      { target: '[name="pwdStatus"]', kind: 'select', value: 'yes', label: 'Add optional PWD status', duration: 1800 },
      { target: '[data-demo="need-mobility"]', kind: 'click', label: 'Specify mobility assistance', duration: 1800 },
      { target: '[data-demo="share-emergency-profile"]', kind: 'click', label: 'Opt in to share emergency needs', duration: 2200 },
      { target: '[data-demo="save-profile"]', kind: 'click', label: 'Save the fictional profile', duration: 1800 },
      { target: '[data-demo="profile-saved"]', label: 'Share needs while keeping contact access separate', duration: 2800 },
    ] },
  { id: 'teams', label: 'Groups & leaders', title: 'Build a response group',
    description: 'Create a group, add personnel, and assign leaders. A named-group alert reaches its members wherever they are, including outside a geofence.',
    cues: [
      { target: '[data-demo="nav-groups"]', kind: 'click', label: 'Open groups', duration: 1600 },
      { target: '[data-demo="create-group"]', kind: 'click', label: 'Create a response team', duration: 1600 },
      { target: '[aria-label="Group name"]', kind: 'type', value: 'Flood response', label: 'Name the group', duration: 1800 },
      { target: '[aria-label="Primary leader"]', kind: 'select', value: 'demo-alex', label: 'Assign Alex as primary leader', duration: 1800 },
      { target: '[data-demo="save-group"]', kind: 'click', label: 'Save the sample group', duration: 1900 },
      { target: '[data-demo="add-members"]', kind: 'click', label: 'Add registered personnel', duration: 1600 },
      { target: '[data-demo="pick-demo-sam"]', kind: 'click', label: 'Add Sam, outside the demo area', duration: 1600 },
      { target: '[data-demo="pick-demo-kai"]', kind: 'click', label: 'Include Kai, currently off duty', duration: 1600 },
      { target: '[data-demo="save-members"]', kind: 'click', label: 'Save both members', duration: 1800 },
      { target: '[aria-label="Group role for Sam · Demo"]', kind: 'select', value: 'leader', label: 'Assign an additional leader', duration: 2000 },
      { target: '[data-demo="message-group"]', kind: 'click', label: 'Prepare an alert for this named group', duration: 1800 },
      { target: '[data-demo="named-group-scope"]', label: 'Geofence position does not exclude group members', duration: 3000 },
      { target: '[aria-label="Group alert priority"]', kind: 'select', value: 'high', label: 'Set message priority', duration: 1600 },
      { target: '[aria-label="Group alert message"]', kind: 'type', value: 'DEMO ALERT: Flood response team, report your availability and prepare for your assigned area.', label: 'Type the group announcement', duration: 4000 },
      { target: '[data-demo="send-group-preview"]', kind: 'click', label: 'Simulate a group broadcast', duration: 1800 },
      { target: '[data-demo="mobile-receipt"]', label: 'Preview the personnel notification and acknowledgment', duration: 4000 },
    ] },
  { id: 'map', label: 'Live map', title: 'Inspect the incident area',
    description: 'Switch map views and zoom in to understand the surroundings.',
    cues: [
      { target: '[data-demo="street"]', kind: 'click', label: 'Switch to the street map', duration: 2600 },
      { target: '[aria-label="Zoom in"]', kind: 'click', label: 'Zoom into the area', duration: 2200 },
      { target: '[data-demo="satellite"]', kind: 'click', label: 'Check satellite imagery', duration: 2800 },
    ] },
  { id: 'geofence', label: 'Geofences', title: 'Draw the affected area',
    description: 'Name a geofence, place its boundary points, and save it. This area exists only for the presentation.',
    cues: [
      { target: '[aria-label="Geofence alert area"]', kind: 'click', label: 'Open geofence tools', duration: 1700 },
      { target: '[aria-label="Draw a new geofence"]', kind: 'click', label: 'Create a polygon', duration: 1600 },
      { target: '[aria-label="Draft geofence name"]', kind: 'type', value: presentationArea.name, label: 'Name the alert area', duration: 2400 },
      ...presentationArea.points.map((point, index) => ({ target: '.ops-map-canvas', kind: 'map-point' as const, point, label: `Place boundary point ${index + 1} of ${presentationArea.points.length}`, duration: 1700 })),
      { target: '[data-demo="save-area"]', kind: 'click', label: 'Save the demo geofence', duration: 2400 },
      { target: '[aria-label="Close geofence tools"]', kind: 'click', label: 'Review the population inside', duration: 1500 },
    ] },
  { id: 'population', label: 'Population', title: 'See who is inside',
    description: 'See located people inside the boundary. Age and PWD counts use the emergency details people choose to share. These are fictional app users, not census totals.',
    cues: [
      { target: '.ops-population-total', label: 'Count people inside the geofence', duration: 3500 },
      { target: '.ops-population-groups', label: 'Review shared age ranges and PWD needs', duration: 4000 },
    ] },
  { id: 'audience', label: 'Alert reach', title: 'Choose an audience',
    description: 'Open a targeted alert for persons with disabilities in this area. Only eligible locations are included.',
    cues: [
      { target: '.ops-quick-audience', label: 'Choose a priority group', duration: 2500 },
      { target: '[data-demo="audience-pwd"]', kind: 'click', label: 'Preview a PWD alert', duration: 2500 },
      { target: '.ops-recipient-summary', label: 'Check the eligible recipient count', duration: 3000 },
    ] },
  { id: 'exposure', label: 'Exposure', title: 'Review people’s locations',
    description: 'Inspect a recipient’s last shared position, then include children in the same alert. Overlapping groups are counted once.',
    cues: [
      { target: '.ops-recipient-list button', kind: 'click', label: 'Locate a recipient on the exposure map', duration: 3000 },
      { target: '.ops-exposure-map', label: 'Review location and boundary', duration: 3000 },
      { target: '[data-demo="group-children"]', kind: 'click', label: 'Include children in the audience', duration: 2600 },
      { target: '.ops-recipient-summary', label: 'Recalculate unique recipients', duration: 2200 },
    ] },
  { id: 'message', label: 'Messaging', title: 'Compose and simulate an alert',
    description: 'Set the priority, type clear instructions, and preview a delivery confirmation. No real message is sent.',
    cues: [
      { target: '[aria-label="Alert priority"]', kind: 'select', value: 'critical', label: 'Set the alert priority', duration: 1800 },
      { target: '[aria-label="Alert message"]', kind: 'type', value: presentationMessage, label: 'Type the emergency announcement', duration: 7500 },
      { target: '.ops-send-demo', kind: 'click', label: 'Simulate delivery to this audience', duration: 2000 },
      { target: '.ops-tour-delivery', label: 'Presentation confirmation · nothing sent', duration: 3500 },
    ] },
  { id: 'mobile-alert', label: 'Mobile app · alerts', title: 'Now, on the phone',
    description: 'See the mobile experience after an alert: open the notification, read the instructions, and acknowledge it. The operator sees the read receipt immediately in this simulation.',
    cues: [
      { target: '[data-demo="mobile-home-screen"]', label: 'Meet the TANOVIQ mobile app', duration: 3200 },
      { target: '[data-demo="mobile-notification"]', kind: 'click', label: 'Open the sample flood notification', duration: 2400 },
      { target: '[data-demo="mobile-alert-message"]', label: 'Read the command center’s instructions', duration: 4200 },
      { target: '[data-demo="mobile-acknowledge"]', kind: 'click', label: 'Confirm that the alert has been read', duration: 2300 },
      { target: '[data-demo="mobile-command-receipt"]', label: 'The operator sees Alex’s acknowledgment', duration: 3300 },
      { target: '[data-demo="mobile-nav-account"]', kind: 'click', label: 'Open Account & privacy on the phone', duration: 2100 },
      { target: '[data-demo="mobile-profile"]', label: 'Emergency needs are shared by choice; contacts stay masked', duration: 3600 },
    ] },
  { id: 'mobile-help', label: 'Mobile app · assistance', title: 'Help goes both ways',
    description: 'Start a sample duty session, share a fictional position, and request evacuation assistance. Watch the operator assign a response team and the phone display the update.',
    cues: [
      { target: '[data-demo="mobile-nav-area"]', kind: 'click', label: 'Open My area on the phone', duration: 1900 },
      { target: '[data-demo="mobile-share-location"]', kind: 'click', label: 'Start duty with a fictional GPS position', duration: 2300 },
      { target: '[data-demo="mobile-command-location"]', label: 'The shared location appears for the operator', duration: 3300 },
      { target: '[data-demo="mobile-nav-help"]', kind: 'click', label: 'Request help from the phone', duration: 1900 },
      { target: '[aria-label="Mobile demo assistance needed"]', kind: 'select', value: 'Evacuation', label: 'Choose evacuation assistance', duration: 1800 },
      { target: '[aria-label="Mobile demo people needing assistance"]', kind: 'type', value: '2', label: 'Indicate how many people need help', duration: 1600 },
      { target: '[aria-label="Mobile demo assistance details"]', kind: 'type', value: mobilePresentationHelpNote, label: 'Describe the situation and assistance needed', duration: 4900 },
      { target: '[data-demo="mobile-send-help"]', kind: 'click', label: 'Submit the sample request with its location', duration: 2200 },
      { target: '[data-demo="mobile-command-request"]', label: 'The request arrives in the command-center inbox', duration: 3300 },
      { target: '[data-demo="mobile-assign-response"]', kind: 'click', label: 'The operator assigns a sample response team', duration: 2300 },
      { target: '[data-demo="mobile-request-status"]', label: 'The phone shows the assigned team and request progress', duration: 4200 },
    ] },
  { id: 'mobile-responder', label: 'Ambulance navigation', title: 'An alert becomes a route',
    description: 'Send an ambulance its assignment and incident location together. Receipt opens the responder map automatically, then the simulated vehicle follows directions to the emergency.',
    cues: [
      { target: '[data-demo="navigation-ready"]', label: 'Ambulance 01 is ready for an assignment', duration: 2400 },
      { target: '[data-demo="navigation-send"]', kind: 'click', label: 'Send the demo dispatch with its emergency destination', duration: 2400 },
      { target: '[data-demo="navigation-received"]', label: 'The alert opens navigation without a tap on the phone', duration: 4200 },
      { target: '[data-demo="navigation-phone"]', label: 'Follow the route line and changing turn instructions', duration: 9000 },
      { target: '[data-demo="navigation-tracking"]', label: 'The operator follows ambulance progress to the scene', duration: 9500 },
      { target: '[data-demo="navigation-destination"]', label: 'The ambulance reaches the sample emergency location', duration: 4000 },
    ] },
  { id: 'mobile-evacuation', label: 'Resident evacuation', title: 'An alert opens the way',
    description: 'An evacuation alert automatically opens the resident’s map toward the nearest available sample evacuation center. The route and progress appear on both sides.',
    cues: [
      { target: '[data-demo="navigation-dispatch"]', label: 'Prepare an evacuation alert for residents in the area', duration: 2400 },
      { target: '[data-demo="navigation-send"]', kind: 'click', label: 'Send the sample evacuation alert', duration: 2400 },
      { target: '[data-demo="navigation-received"]', label: 'The resident map opens automatically on receipt', duration: 4000 },
      { target: '[data-demo="navigation-nearest"]', label: 'Choose the nearest available center; exclude the closed shelter', duration: 4500 },
      { target: '[data-demo="navigation-phone"]', label: 'Follow walking directions toward the evacuation center', duration: 8000 },
      { target: '[data-demo="navigation-tracking"]', label: 'See progress toward the sample destination', duration: 6500 },
      { target: '[data-demo="navigation-destination"]', label: 'The resident reaches the sample evacuation center', duration: 4000 },
    ] },
  { id: 'responders', label: 'Response', title: 'Follow the ambulance',
    description: 'Select an ambulance and fit its road route. Watch its position, destination, distance, and ETA update at demo speed.',
    cues: [
      { target: '.ops-ambulance-shortcut', kind: 'click', label: 'Locate the ambulance', duration: 2300 },
      { target: '[data-demo="fit-route"]', kind: 'click', label: 'Show the full route to the destination', duration: 2200 },
      { target: '[aria-label="Restart responder routes"]', kind: 'click', label: 'Start the ambulance journey', duration: 2000 },
      { target: '.ops-route-metrics', label: 'Track movement and remaining travel time', duration: 8000 },
    ] },
  { id: 'cctv', label: 'CCTV', title: 'Verify conditions on camera',
    description: 'Open the camera wall, filter flood monitoring feeds, and enlarge a camera to inspect the scene.',
    cues: [
      { target: '[data-demo="nav-cctv"]', kind: 'click', label: 'Open CCTV monitoring', duration: 2600 },
      { target: '[data-demo="cctv-flood"]', kind: 'click', label: 'Show flood monitoring cameras', duration: 3000 },
      { target: '.cctv-expand', kind: 'click', label: 'Enlarge the flood monitoring feed', duration: 2200 },
      { target: '.cctv-dialog .cctv-video', label: 'Inspect the flood camera · illustrative footage', duration: 3800 },
      { target: '.cctv-dialog > button:last-child', kind: 'click', label: 'Return to the camera wall', duration: 1800 },
      { target: '[data-demo="nav-map"]', kind: 'click', label: 'Return to live operations', duration: 1800 },
    ] },
  { id: 'logs', label: 'Activity logs', title: 'Keep a record of operations',
    description: 'Review group changes, saved boundaries and alert activity. Search logs by action or preferred name. This chapter contains fictional events only.',
    cues: [
      { target: '[data-demo="nav-activity"]', kind: 'click', label: 'Open activity logs', duration: 1800 },
      { target: '.activity-table', label: 'Review actions and responsible operators', duration: 2800 },
      { target: '[aria-label="Search activity logs"]', kind: 'type', value: 'group', label: 'Filter the activity list', duration: 2000 },
      { target: '.activity-table', label: 'Trace the group workflow', duration: 2800 },
    ] },
  { id: 'complete', label: 'Complete', title: 'From awareness to response',
    description: 'Alerts, mobile acknowledgments, ambulance dispatch and resident evacuation work together. The presentation will restart automatically with fresh sample data. Exit any time to restore your original workspace.',
    cues: [{ target: '.ops-demo-button', label: 'Starting the next loop automatically', duration: 4500 }] },
];

export const tourMoveDuration = 700;
export const tourTypingInterval = 28;
export function tourStepDuration(index: number) { return presentationSteps[index].cues.reduce((total, cue) => total + cue.duration, 0); }
export function tourCueAt(index: number, elapsed: number) {
  let start = 0;
  const cues = presentationSteps[index].cues;
  for (let i = 0; i < cues.length; i++) {
    if (elapsed < start + cues[i].duration || i === cues.length - 1) return { cue: cues[i], index: i, elapsed: Math.max(0, elapsed - start) };
    start += cues[i].duration;
  }
  throw new Error('A presentation step must contain an action.');
}

export function tourStepIndex(current: number, action: 'next' | 'back' | 'restart') {
  if (action === 'restart') return 0;
  if (action === 'next' && current === presentationSteps.length - 1) return 0;
  return Math.max(0, Math.min(presentationSteps.length - 1, current + (action === 'next' ? 1 : -1)));
}

export function tourCardPosition(target: { left: number; top: number; right: number; bottom: number } | null, viewport: { width: number; height: number }, card: { width: number; height: number }) {
  const margin = 18;
  const gap = 20;
  const width = Math.min(card.width, viewport.width - margin * 2);
  const height = Math.min(card.height, viewport.height - margin * 2);
  const clampX = (x: number) => Math.max(margin, Math.min(x, viewport.width - width - margin));
  const clampY = (y: number) => Math.max(margin, Math.min(y, viewport.height - height - margin));
  if (!target) return { left: clampX(viewport.width - width - margin), top: clampY(viewport.height - height - margin) };
  if (viewport.width < 700) return { left: margin, top: target.top > viewport.height / 2 ? margin : viewport.height - height - margin };
  if (target.left - width - gap >= margin) return { left: clampX(target.left - width - gap), top: clampY(target.top) };
  if (target.right + width + gap <= viewport.width - margin) return { left: clampX(target.right + gap), top: clampY(target.top) };
  if (target.bottom + height + gap <= viewport.height - margin) return { left: clampX(target.left), top: clampY(target.bottom + gap) };
  if (target.top - height - gap >= margin) return { left: clampX(target.left), top: clampY(target.top - height - gap) };
  return { left: clampX(viewport.width - width - margin), top: clampY(viewport.height - height - margin) };
}

