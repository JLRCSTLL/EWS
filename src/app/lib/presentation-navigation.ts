export type NavigationChapter = 'mobile-responder' | 'mobile-evacuation';
export const isNavigationChapter = (id: string): id is NavigationChapter => id === 'mobile-responder' || id === 'mobile-evacuation';
export type DemoPoint = readonly [number, number];
export interface DemoRoute {
  id: string;
  destination: string;
  points: readonly DemoPoint[];
  mode: 'drive' | 'walk';
}
export interface DemoShelter extends DemoRoute { open: boolean; spaces: number }

// Entirely fictional street geometry and facilities. Never use this data for
// live routing, shelter availability or emergency guidance.
export const demoIncident = { label: 'Community hall · sample emergency', point: [250, 120] as DemoPoint };
export const ambulanceDemoRoute: DemoRoute = {
  id: 'demo-incident', destination: demoIncident.label, mode: 'drive',
  points: [[40, 300], [110, 300], [110, 230], [250, 230], demoIncident.point],
};
export const demoShelters: readonly DemoShelter[] = [
  { id: 'demo-closed', destination: 'Riverside shelter', open: false, spaces: 0, mode: 'walk', points: [demoIncident.point, [250, 60]] },
  { id: 'demo-school', destination: 'North school', open: true, spaces: 55, mode: 'walk', points: [demoIncident.point, [250, 230], [110, 230], [110, 300], [40, 300]] },
  { id: 'demo-gym', destination: 'Community gym', open: true, spaces: 120, mode: 'walk', points: [demoIncident.point, [250, 60], [110, 60]] },
  { id: 'demo-civic', destination: 'Civic center', open: true, spaces: 80, mode: 'walk', points: [demoIncident.point, [250, 230], [250, 300], [290, 300]] },
];
export const demoJourneySeconds = 24;
const segmentLength = (a: DemoPoint, b: DemoPoint) => Math.hypot(b[0] - a[0], b[1] - a[1]);
export const routeLength = (route: DemoRoute) => route.points.slice(1).reduce((sum, point, i) => sum + segmentLength(route.points[i], point), 0);
export const routeMeters = (route: DemoRoute) => Math.round(routeLength(route) * 5);
export function nearestDemoShelter(shelters: readonly DemoShelter[] = demoShelters) {
  return shelters.filter(shelter => shelter.open && shelter.spaces > 0 && shelter.points.length > 1)
    .reduce<DemoShelter | null>((nearest, shelter) => !nearest || routeLength(shelter) < routeLength(nearest) ? shelter : nearest, null);
}
export interface NavigationState {
  chapter: NavigationChapter;
  delivered: boolean;
  route: DemoRoute | null;
  progress: number;
}
export type NavigationAction = { type: 'receive-alert' } | { type: 'tick'; seconds: number };
export function createNavigationPresentation(chapter: NavigationChapter): NavigationState {
  return { chapter, delivered: false, route: null, progress: 0 };
}
export function navigationReducer(state: NavigationState, action: NavigationAction): NavigationState {
  if (action.type === 'receive-alert') {
    // Receiving the message itself opens navigation; no recipient tap required.
    return state.delivered ? state : { ...state, delivered: true,
      route: state.chapter === 'mobile-responder' ? ambulanceDemoRoute : nearestDemoShelter() };
  }
  if (!state.route || state.progress >= 1 || !Number.isFinite(action.seconds) || action.seconds <= 0) return state;
  return { ...state, progress: Math.min(1, state.progress + action.seconds / demoJourneySeconds) };
}
export function routePosition(route: DemoRoute, progress: number) {
  const total = routeLength(route);
  let remaining = total * Math.max(0, Math.min(1, progress));
  for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    const length = segmentLength(a, b);
    if (remaining <= length || i === route.points.length - 1) {
      const fraction = length ? Math.min(1, remaining / length) : 1;
      const point: DemoPoint = [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
      const next = route.points[i + 1];
      const cross = next ? (b[0] - a[0]) * (next[1] - b[1]) - (b[1] - a[1]) * (next[0] - b[0]) : 0;
      return { point, bearing: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI + 90,
        nextTurn: next ? cross > 0 ? 'Turn right' : cross < 0 ? 'Turn left' : 'Continue straight' : 'Continue to your destination',
        turnMeters: Math.max(0, Math.round((length - remaining) * 5 / 10) * 10),
        remainingMeters: Math.max(0, Math.round(total * (1 - progress) * 5)) };
    }
    remaining -= length;
  }
  return { point: route.points[0], bearing: 0, nextTurn: 'Destination reached', turnMeters: 0, remainingMeters: 0 };
}
