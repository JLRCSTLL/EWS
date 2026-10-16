export type GeofenceShape = 'polygon' | 'rectangle' | 'circle';
export interface GeofencePoint { lat: number; lng: number }
export interface GeofenceGeometry { shape: GeofenceShape; points: GeofencePoint[] }
export interface AlertGeofence extends GeofenceGeometry { id: string; name: string }

const EARTH_RADIUS = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function geofenceDistance(a: GeofencePoint, b: GeofencePoint) {
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function geofenceArea({ shape, points }: GeofenceGeometry) {
  if (shape === 'circle') return points.length === 2 ? Math.PI * geofenceDistance(points[0], points[1]) ** 2 : 0;
  const ring = shape === 'rectangle' && points.length === 2
    ? [points[0], { lat: points[0].lat, lng: points[1].lng }, points[1], { lat: points[1].lat, lng: points[0].lng }]
    : points;
  if (ring.length < 3) return 0;
  return Math.abs(ring.reduce((sum, point, index) => {
    const next = ring[(index + 1) % ring.length];
    return sum + radians(next.lng - point.lng) * (2 + Math.sin(radians(point.lat)) + Math.sin(radians(next.lat)));
  }, 0) * EARTH_RADIUS ** 2 / 2);
}

export function formatGeofenceArea(geometry: GeofenceGeometry) {
  const area = geofenceArea(geometry);
  return area >= 1_000_000 ? `${(area / 1_000_000).toFixed(2)} km²` : `${Math.round(area).toLocaleString()} m²`;
}

const orient = (a: GeofencePoint, b: GeofencePoint, c: GeofencePoint) =>
  (b.lng - a.lng) * (c.lat - a.lat) - (b.lat - a.lat) * (c.lng - a.lng);
const onSegment = (a: GeofencePoint, b: GeofencePoint, p: GeofencePoint) =>
  Math.abs(orient(a, b, p)) < 1e-12 && p.lng >= Math.min(a.lng, b.lng) && p.lng <= Math.max(a.lng, b.lng) &&
  p.lat >= Math.min(a.lat, b.lat) && p.lat <= Math.max(a.lat, b.lat);
const intersects = (a: GeofencePoint, b: GeofencePoint, c: GeofencePoint, d: GeofencePoint) =>
  (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
  onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);

export function getGeofenceError(geometry: GeofenceGeometry): string | null {
  const { shape, points } = geometry;
  if (!['polygon', 'rectangle', 'circle'].includes(shape) || !Array.isArray(points)) return 'Choose a supported area shape.';
  if (points.some((point) => !point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 85 || Math.abs(point.lng) > 180)) return 'All points must be valid map coordinates.';
  if (shape === 'polygon' && points.length < 3) return 'Add at least three points to outline your area.';
  if (shape !== 'polygon' && points.length !== 2) return shape === 'circle' ? 'Choose the center, then a point on the edge.' : 'Choose two opposite corners.';
  if (points.length > 100) return 'Use no more than 100 points.';
  if (Math.max(...points.map((point) => point.lng)) - Math.min(...points.map((point) => point.lng)) > 180) return 'Draw an area on one side of the date line.';
  if (new Set(points.map((point) => `${point.lat},${point.lng}`)).size !== points.length) return 'Move overlapping points apart.';
  if (shape === 'polygon') {
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (j === i + 1 || (i === 0 && j === points.length - 1)) continue;
        if (intersects(points[i], points[(i + 1) % points.length], points[j], points[(j + 1) % points.length])) return 'The boundary crosses itself. Move or undo a point.';
      }
    }
  }
  if (geofenceArea(geometry) < 100) return 'Draw a larger area with distinct corners or a wider radius.';
  return null;
}

export function isAlertGeofence(value: unknown): value is AlertGeofence {
  if (!value || typeof value !== 'object') return false;
  const area = value as AlertGeofence;
  return typeof area.id === 'string' && typeof area.name === 'string' && area.name.trim().length > 0 &&
    area.name.length <= 60 && !getGeofenceError(area);
}
