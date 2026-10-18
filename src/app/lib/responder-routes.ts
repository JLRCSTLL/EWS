import { geofenceDistance, type GeofencePoint } from './geofencing.ts';
import { responderRouteData } from './responder-route-data.ts';

export const RESPONDER_DEMO_SPEED = 8;

export const responderRoutes = responderRouteData.map(route => {
  const points = route.points.map(([lat, lng]) => ({ lat, lng }))
    .filter((point, index, all) => !index || point.lat !== all[index - 1].lat || point.lng !== all[index - 1].lng);
  const cumulativeMeters = [0];
  for (let index = 1; index < points.length; index++) {
    cumulativeMeters.push(cumulativeMeters[index - 1] + geofenceDistance(points[index - 1], points[index]));
  }
  return { ...route, points, cumulativeMeters, totalMeters: cumulativeMeters[cumulativeMeters.length - 1] };
});

export type ResponderRoute = typeof responderRoutes[number];
export const RESPONDER_DEMO_DURATION = Math.max(...responderRoutes.map(route => route.modelDurationSeconds * (1 - route.initialProgress) / RESPONDER_DEMO_SPEED));

function bearing(a: GeofencePoint, b: GeofencePoint) {
  const radians = Math.PI / 180;
  const longitude = (b.lng - a.lng) * radians;
  const y = Math.sin(longitude) * Math.cos(b.lat * radians);
  const x = Math.cos(a.lat * radians) * Math.sin(b.lat * radians) - Math.sin(a.lat * radians) * Math.cos(b.lat * radians) * Math.cos(longitude);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

export function routePosition(route: ResponderRoute, fraction: number) {
  const progress = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  const traveledMeters = route.totalMeters * progress;
  let low = 1;
  let high = route.points.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (route.cumulativeMeters[middle] < traveledMeters) low = middle + 1;
    else high = middle;
  }
  const a = route.points[low - 1];
  const b = route.points[low];
  const segment = route.cumulativeMeters[low] - route.cumulativeMeters[low - 1];
  const ratio = segment ? (traveledMeters - route.cumulativeMeters[low - 1]) / segment : 0;
  const position = { lat: a.lat + (b.lat - a.lat) * ratio, lng: a.lng + (b.lng - a.lng) * ratio };
  return {
    progress, position, heading: bearing(a, b), arrived: progress >= 1,
    remainingMeters: route.totalMeters - traveledMeters,
    remainingSeconds: route.modelDurationSeconds * (1 - progress),
    remainingPoints: [position, ...route.points.slice(low)],
  };
}

export function getRouteProgress(route: ResponderRoute, elapsedSeconds: number) {
  const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
  return routePosition(route, route.initialProgress + elapsed * RESPONDER_DEMO_SPEED / route.modelDurationSeconds);
}

export function formatRouteDistance(meters: number) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters)} m`;
}
