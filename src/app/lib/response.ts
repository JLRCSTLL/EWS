export type ResponseStatus =
  | "reported"
  | "validated"
  | "rejected"
  | "assigned"
  | "en_route"
  | "on_scene"
  | "to_hospital"
  | "at_hospital"
  | "returning"
  | "completed"
  | "cancelled";
export interface ResponsePoint {
  lat: number;
  lng: number;
  label: string;
}
export interface ResponseIncident {
  id: string;
  request_id: string | null;
  title: string;
  notes: string;
  priority: "normal" | "high" | "critical";
  service: string;
  status: ResponseStatus;
  location: ResponsePoint;
  base: ResponsePoint | null;
  hospital: ResponsePoint | null;
  assigned_id: string | null;
  assigned_name: string | null;
  unit: string;
  validation_note: string;
  version: number;
  route_origin: ResponsePoint | null;
  created_at: string;
  updated_at: string;
}
export interface ResponseFacility {
  id: string;
  kind: "base" | "hospital";
  name: string;
  location: ResponsePoint;
}
export interface NearbyHospital extends ResponsePoint {
  id: string;
  distance: number;
  source: string;
  emergency: string;
}
export interface ResponseRoute {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  origin: ResponsePoint;
  destination: ResponsePoint;
  originSource: string;
  generatedAt: string;
  steps: {
    instruction: string;
    distance: number;
    duration: number;
    point: ResponsePoint;
    type: string;
    modifier: string;
  }[];
}
export interface ResponseMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  body: string;
  created_at: string;
  has_photo: boolean;
  photo_expired: boolean;
  photo_width: number | null;
  photo_height: number | null;
}
export const responseLabels: Record<ResponseStatus, string> = {
  reported: "Awaiting validation",
  validated: "Validated",
  rejected: "Not validated",
  assigned: "Dispatched",
  en_route: "En route to emergency",
  on_scene: "Arrived on scene",
  to_hospital: "Transporting to hospital",
  at_hospital: "Arrived at hospital",
  returning: "Returning to base",
  completed: "Back at base",
  cancelled: "Cancelled",
};
export const activeResponse = (r: ResponseIncident) =>
  [
    "assigned",
    "en_route",
    "on_scene",
    "to_hospital",
    "at_hospital",
    "returning",
  ].includes(r.status);
export const responseTransitions: Partial<
  Record<ResponseStatus, ResponseStatus[]>
> = {
  assigned: ["en_route"],
  en_route: ["on_scene"],
  on_scene: ["to_hospital", "returning"],
  to_hospital: ["at_hospital"],
  at_hospital: ["returning"],
  returning: ["completed"],
};
export const destinationFor = (r: ResponseIncident): ResponsePoint | null =>
  ["completed", "cancelled", "rejected", "reported", "validated"].includes(
    r.status,
  )
    ? null
    : r.status === "returning"
      ? r.base
      : ["to_hospital", "at_hospital"].includes(r.status)
        ? r.hospital
        : r.location;
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = Math.PI / 180,
    dLat = (b.lat - a.lat) * rad,
    dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
}
export function routeProgress(
  points: [number, number][],
  position: { lat: number; lng: number },
) {
  let total = 0,
    best = Infinity,
    along = 0;
  const scale = Math.cos((position.lat * Math.PI) / 180);
  for (let i = 1; i < points.length; i++) {
    const a = { lat: points[i - 1][1], lng: points[i - 1][0] },
      b = { lat: points[i][1], lng: points[i][0] };
    const dx = (b.lng - a.lng) * scale,
      dy = b.lat - a.lat;
    const t = Math.max(
      0,
      Math.min(
        1,
        ((position.lng - a.lng) * scale * dx + (position.lat - a.lat) * dy) /
          (dx * dx + dy * dy || 1),
      ),
    );
    const gap = distanceMeters(position, {
      lat: a.lat + t * (b.lat - a.lat),
      lng: a.lng + t * (b.lng - a.lng),
    });
    const length = distanceMeters(a, b);
    if (gap < best) {
      best = gap;
      along = total + t * length;
    }
    total += length;
  }
  return {
    distanceAlong: along,
    remaining: Math.max(0, total - along),
    offRoute: best,
  };
}
export const responseDistance = (m: number) =>
  m >= 1000 ? (m / 1000).toFixed(1) + " km" : Math.round(m) + " m";
