import { demoGeofences } from './residents.ts';

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
  { id: 'welcome', label: 'Welcome', title: 'Watch E-Ligtas in action',
    description: 'Follow the cursor through a complete command-center workflow. Everything runs automatically with sample data.',
    cues: [{ target: '.ops-brand', label: 'Your emergency command center', duration: 4000 }] },
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
    description: 'The selected boundary reveals located app users and priority groups. These are demo users, not census totals.',
    cues: [
      { target: '.ops-population-total', label: 'Count people inside the geofence', duration: 3500 },
      { target: '.ops-population-groups', label: 'Review PWD, children, seniors and other groups', duration: 4000 },
    ] },
  { id: 'groups', label: 'Alert reach', title: 'Choose an audience',
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
  { id: 'complete', label: 'Complete', title: 'From awareness to response',
    description: 'Monitor, define an area, identify people, communicate, and coordinate. Your original workspace will return automatically.',
    cues: [{ target: '.ops-demo-button', label: 'Replay any time with Demo', duration: 4500 }] },
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

