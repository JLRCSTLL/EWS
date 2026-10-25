import { getGeofenceError, type GeofenceGeometry, type GeofencePoint } from './geofencing.ts';

export type PlaceLevel = 'barangay' | 'municipality' | 'province';
export interface BoundaryPlace { id: number; level: PlaceLevel; name: string; municipality: string; province: string; label: string }
export const boundarySource = 'GEODATA · Philippine Administrative Boundaries';
export const boundarySourceUrl = 'https://services7.arcgis.com/poQdgvLD6DHnbpsT/arcgis/rest/services/Philippine_Administrative_Boundaries/FeatureServer';
export const boundaryNote = 'Indicative boundaries from 2015/2020 source data. Confirm local boundary changes before operational use.';
const layers = {
  province: { id:1, key:'OBJECTID_1', name:'PROVINCE', fields:['PROVINCE','REGION'] },
  municipality: { id:2, key:'OBJECTID', name:'CITYMUN', fields:['CITYMUN','PROVINCE','REGION'] },
  barangay: { id:3, key:'OBJECTID', name:'BRGY_NAME', fields:['BRGY_NAME','CITYMUN','PROVINCE','REGION'] },
};
export const normalizePlaceQuery = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\b(barangay|barangays|brangay|brgy|municipality|municipal|municipalities|city|province|of|in|philippines)\b/g,' ').replace(/[^a-z0-9ñ\s-]/g,' ').trim().replace(/\s+/g,' ');
export function placeWhere(query: string, level: PlaceLevel) {
  const tokens = normalizePlaceQuery(query).split(' ').filter(Boolean);
  if (!tokens.length || tokens.length > 12 || query.length > 120) throw new Error('Enter a place name of up to 120 characters.');
  return tokens.map(token => `(${layers[level].fields.map(field => `UPPER(${field}) LIKE '%${token.toUpperCase()}%'`).join(' OR ')})`).join(' AND ');
}
async function queryLayer(level: PlaceLevel, params: Record<string,string>, signal?: AbortSignal) {
  // Public, read-only boundary service. No device locations or account data are sent.
  const url = new URL(`${boundarySourceUrl}/${layers[level].id}/query`);
  url.search = new URLSearchParams({f:'geojson',outSR:'4326',...params}).toString();
  const response = await fetch(url,{signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),credentials:'omit'});
  if (!response.ok) throw new Error('The boundary service is unavailable. Try again shortly.');
  const json = await response.json();
  if (json.error || !Array.isArray(json.features)) throw new Error('The boundary service could not complete this search.');
  return json;
}
export async function searchPlaces(query: string, level: PlaceLevel | 'all', signal?: AbortSignal): Promise<{places:BoundaryPlace[];partial:boolean}> {
  const requested = level === 'all' ? ['barangay','municipality','province'] as PlaceLevel[] : [level];
  const results = await Promise.allSettled(requested.map(async kind => {
    const layer = layers[kind];
    const json = await queryLayer(kind,{where:placeWhere(query,kind),outFields:[layer.key,...layer.fields].join(','),returnGeometry:'false',resultRecordCount:'12',orderByFields:layer.fields.join(',')},signal);
    return json.features.map((feature: any) => {
      const p = feature.properties;
      return {id:p[layer.key],level:kind,name:p[layer.name],municipality:kind === 'barangay' ? p.CITYMUN : '',province:kind !== 'province' ? p.PROVINCE : '',label:[p[layer.name],kind === 'barangay' ? p.CITYMUN : '',kind !== 'province' ? p.PROVINCE : ''].filter(Boolean).join(', ')} as BoundaryPlace;
    }).filter((p: BoundaryPlace) => Number.isInteger(p.id) && p.name);
  }));
  if (signal?.aborted) throw new DOMException('Search cancelled','AbortError');
  if (results.every(r => r.status === 'rejected')) throw new Error('Unable to load place boundaries. Check your connection and retry.');
  const normalized = normalizePlaceQuery(query);
  const places = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  places.sort((a,b) => Number(normalizePlaceQuery(b.name) === normalized) - Number(normalizePlaceQuery(a.name) === normalized) || a.label.localeCompare(b.label));
  return {places,partial:results.some(r => r.status === 'rejected')};
}
export function boundaryGeometry(geometry: any): GeofenceGeometry {
  const raw = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null;
  if (!Array.isArray(raw) || !raw.length) throw new Error('No area boundary is available for this place.');
  const polygons: GeofencePoint[][][] = raw.map((rings: any[]) => rings.map((ring: number[][]) => {
    const points = ring.map(([lng,lat]) => ({lat,lng}));
    if (points.length > 1 && points[0].lat === points.at(-1)!.lat && points[0].lng === points.at(-1)!.lng) points.pop();
    return points;
  }));
  const points = polygons.flat(2);
  let south=90,north=-90,west=180,east=-180;
  for (const p of points) { south=Math.min(south,p.lat);north=Math.max(north,p.lat);west=Math.min(west,p.lng);east=Math.max(east,p.lng); }
  const result: GeofenceGeometry = {shape:'boundary',points:[{lat:south,lng:west},{lat:north,lng:east}],polygons};
  const error = getGeofenceError(result);
  if (error) throw new Error(error);
  return result;
}
export async function loadPlaceBoundary(place: BoundaryPlace, signal?: AbortSignal): Promise<GeofenceGeometry> {
  for (const offset of ['0.00005','0.0005','0.002']) {
    const json = await queryLayer(place.level,{objectIds:String(place.id),outFields:layers[place.level].key,returnGeometry:'true',geometryPrecision:'6',maxAllowableOffset:offset},signal);
    if (json.features.length !== 1) throw new Error('This boundary is no longer available. Search again.');
    try {
      const geometry = boundaryGeometry(json.features[0].geometry);
      const detail = offset === '0.00005' ? '' : ` Coastline detail simplified with a tolerance of approximately ${offset === '0.0005' ? '55' : '220'} metres.`;
      return {...geometry,source:{label:boundarySource,url:boundarySourceUrl,recordId:`${place.level}-${place.id}`,level:place.level,note:boundaryNote+detail}};
    } catch(error) {
      if (offset === '0.002' || !(error instanceof Error) || !/too detailed|no usable polygon/.test(error.message)) throw error;
    }
  }
  throw new Error('Unable to load this boundary. Try again.');
}
