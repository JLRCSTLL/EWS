export type GeofenceShape = 'polygon' | 'rectangle' | 'circle' | 'boundary';
export interface GeofencePoint { lat: number; lng: number }
export interface GeofenceGeometry {
  shape: GeofenceShape; points: GeofencePoint[];
  /** Imported administrative geometry: polygons, each containing an exterior ring and any holes. */
  polygons?: GeofencePoint[][][];
  source?: { label: string; url: string; recordId: string; level: string; note: string };
}
export interface AlertGeofence extends GeofenceGeometry { id: string; name: string }

const EARTH_RADIUS = 6_371_008.8;
const radians = (degrees: number) => degrees * Math.PI / 180;

export function geofenceDistance(a: GeofencePoint, b: GeofencePoint) {
  const h = Math.sin(radians(b.lat - a.lat) / 2) ** 2 +
    Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_RADIUS * Math.asin(Math.sqrt(Math.min(1, h)));
}

export function geofenceArea({ shape, points, polygons }: GeofenceGeometry) {
  if (shape === 'boundary') return (polygons || []).reduce((total, rings) => total + Math.max(0, rings.reduce((area, ring, index) => area + (index ? -1 : 1) * geofenceArea({ shape:'polygon', points:ring }), 0)), 0);
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

/** Boundary points count as inside. Coordinates use latitude/longitude, not screen pixels. */
export function isPointInGeofence(point: GeofencePoint, geometry: GeofenceGeometry): boolean {
  return !getGeofenceError(geometry) && containsPoint(point, geometry);
}
/** Validate a complex boundary once before testing an entire personnel directory. */
export function geofenceMatcher(geometry: GeofenceGeometry): (point: GeofencePoint) => boolean {
  if (getGeofenceError(geometry)) return () => false;
  return point => containsPoint(point,geometry);
}
function containsPoint(point: GeofencePoint, geometry: GeofenceGeometry): boolean {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng) || Math.abs(point.lat) > 85 || Math.abs(point.lng) > 180) return false;
  const { shape, points } = geometry;
  if (shape === 'boundary') return geometry.polygons!.some(rings => inRing(point, rings[0]) && !rings.slice(1).some(ring => inRing(point, ring)));
  if (shape === 'circle') return geofenceDistance(points[0], point) <= geofenceDistance(points[0], points[1]) + .01;
  if (shape === 'rectangle') return point.lat >= Math.min(points[0].lat, points[1].lat) &&
    point.lat <= Math.max(points[0].lat, points[1].lat) && point.lng >= Math.min(points[0].lng, points[1].lng) &&
    point.lng <= Math.max(points[0].lng, points[1].lng);
  return inRing(point, points);
}
function inRing(point: GeofencePoint, points: GeofencePoint[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if (onSegment(a, b, point)) return true;
    if ((a.lat > point.lat) !== (b.lat > point.lat) &&
      point.lng < (b.lng - a.lng) * (point.lat - a.lat) / (b.lat - a.lat) + a.lng) inside = !inside;
  }
  return inside;
}
const intersects = (a: GeofencePoint, b: GeofencePoint, c: GeofencePoint, d: GeofencePoint) =>
  (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) ||
  onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);

export function getGeofenceError(geometry: GeofenceGeometry): string | null {
  if (!geometry || typeof geometry !== 'object') return 'Choose a supported area shape.';
  const { shape, points } = geometry;
  if (shape === 'boundary') {
    const polygons = geometry.polygons;
    if (!Array.isArray(points) || points.length !== 2 || !Array.isArray(polygons) || !polygons.length || polygons.length > 1000) return 'This boundary has no usable polygon geometry.';
    let count = 0, south = 90, north = -90, west = 180, east = -180;
    const validPoint = (p: GeofencePoint) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) && Math.abs(p.lat) <= 85 && Math.abs(p.lng) <= 180;
    if (!points.every(validPoint)) return 'All points must be valid map coordinates.';
    for (const rings of polygons) {
      if (!Array.isArray(rings) || !rings.length || rings.length > 1000) return 'This boundary contains invalid rings.';
      for (const ring of rings) {
        if (!Array.isArray(ring) || ring.length < 3 || (count += ring.length) > 20000 || !ring.every(validPoint)) return 'This boundary is invalid or too detailed to save. Choose a smaller area.';
        if (new Set(ring.map(p => `${p.lat},${p.lng}`)).size < 3) return 'This boundary contains an empty ring.';
        for (const p of ring) { south=Math.min(south,p.lat); north=Math.max(north,p.lat); west=Math.min(west,p.lng); east=Math.max(east,p.lng); }
      }
    }
    if (Math.abs(points[0].lat-south)>1e-6 || Math.abs(points[0].lng-west)>1e-6 || Math.abs(points[1].lat-north)>1e-6 || Math.abs(points[1].lng-east)>1e-6) return 'Boundary bounds do not match its mapped area.';
    return geofenceArea(geometry) >= 100 ? null : 'This boundary is too small to use.';
  }
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
