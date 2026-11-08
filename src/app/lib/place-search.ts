import { getGeofenceError, type GeofenceGeometry, type GeofencePoint } from './geofencing.ts';

export type PlaceLevel = 'region' | 'barangay' | 'municipality' | 'province';
export type LocalPlaceLevel = Exclude<PlaceLevel, 'region'>;
export interface BoundaryPlace { id: number | string; level: PlaceLevel; name: string; municipality: string; province: string; region: string; label: string }
export interface BoundarySelection { place: BoundaryPlace; geometry: GeofenceGeometry }
export const boundarySource = 'GEODATA · Philippine Administrative Boundaries';
export const boundarySourceUrl = 'https://services7.arcgis.com/poQdgvLD6DHnbpsT/arcgis/rest/services/Philippine_Administrative_Boundaries/FeatureServer';
export const boundaryNote = 'Indicative boundaries from 2015/2020 source data. Confirm local boundary changes before operational use.';
const layers = {
  province: { id:1, key:'OBJECTID_1', name:'PROVINCE', fields:['PROVINCE','REGION'] },
  municipality: { id:2, key:'OBJECTID', name:'CITYMUN', fields:['CITYMUN','PROVINCE','REGION'] },
  barangay: { id:3, key:'OBJECTID', name:'BRGY_NAME', fields:['BRGY_NAME','CITYMUN','PROVINCE','REGION'] },
};
const regionNames: Record<string, string> = {
  I: 'Ilocos Region', II: 'Cagayan Valley', III: 'Central Luzon', 'IV-A': 'CALABARZON',
  MIMAROPA: 'MIMAROPA', V: 'Bicol Region', VI: 'Western Visayas', VII: 'Central Visayas',
  VIII: 'Eastern Visayas', IX: 'Zamboanga Peninsula', X: 'Northern Mindanao', XI: 'Davao Region',
  XII: 'SOCCSKSARGEN', XIII: 'Caraga', NCR: 'National Capital Region', CAR: 'Cordillera Administrative Region',
  BARMM: 'Bangsamoro Autonomous Region in Muslim Mindanao',
};
const regionAliases: Record<string, string> = { I:'1', II:'2', III:'3', 'IV-A':'4A IVA', MIMAROPA:'IV-B 4B', V:'5', VI:'6', VII:'7', VIII:'8', IX:'9', X:'10', XI:'11', XII:'12', XIII:'13', NCR:'Metro Manila', BARMM:'ARMM Bangsamoro' };
const canonicalRegion = (value: string) => value === 'ARMM' ? 'BARMM' : value;
export const placeLevelLabel = (level: PlaceLevel) => level === 'municipality' ? 'City / municipality' : level.charAt(0).toUpperCase() + level.slice(1);
export const placeKey = (place: BoundaryPlace) => `${place.level}-${place.id}`;
export const normalizePlaceQuery = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\b(barangay|barangays|brangay|brgy|municipality|municipal|municipalities|city|province|region|of|in|philippines)\b/g,' ').replace(/[^a-z0-9ñ\s-]/g,' ').trim().replace(/\s+/g,' ');
export function placeWhere(query: string, level: LocalPlaceLevel) {
  const tokens = normalizePlaceQuery(query).split(' ').filter(Boolean);
  if (!tokens.length || tokens.length > 12 || query.length > 120) throw new Error('Enter a place name of up to 120 characters.');
  return tokens.map(token => `(${layers[level].fields.map(field => `UPPER(${field}) LIKE '%${token.toUpperCase()}%'`).join(' OR ')})`).join(' AND ');
}
async function queryLayer(level: LocalPlaceLevel, params: Record<string,string>, signal?: AbortSignal) {
  // Public, read-only boundary service. No device locations or account data are sent.
  const url = new URL(`${boundarySourceUrl}/${layers[level].id}/query`);
  url.search = new URLSearchParams({f:'geojson',outSR:'4326',...params}).toString();
  const response = await fetch(url,{signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),credentials:'omit'});
  if (!response.ok) throw new Error('The boundary service is unavailable. Try again shortly.');
  const json = await response.json();
  if (json.error || !Array.isArray(json.features)) throw new Error('The boundary service could not complete this search.');
  return json;
}
function placeFromProperties(p: Record<string, unknown>, level: LocalPlaceLevel): BoundaryPlace | null {
  const layer = layers[level], id = p.boundary_id ?? p[layer.key], name = p[layer.name];
  if (!Number.isInteger(id) || typeof name !== 'string' || !name.trim()) return null;
  const value = (key: string) => typeof p[key] === 'string' ? String(p[key]).slice(0,240) : '';
  const municipality = level === 'barangay' ? value('CITYMUN') : '';
  const province = level !== 'province' ? value('PROVINCE') : '';
  return { id: id as number, level, name, municipality, province, region: canonicalRegion(value('REGION')), label: [name, municipality, province].filter(Boolean).join(', ') };
}
function groupedPlaces(level: LocalPlaceLevel, where: string, count: number, offset = 0) {
  const layer = layers[level];
  // Some municipalities have one source record per island. Group before paging,
  // and keep the smallest source ID as the stable reference for the whole area.
  return {
    f:'json', where, returnGeometry:'false', groupByFieldsForStatistics:layer.fields.join(','),
    outStatistics:JSON.stringify([{statisticType:'min',onStatisticField:layer.key,outStatisticFieldName:'boundary_id'}]),
    resultRecordCount:String(count), resultOffset:String(offset), orderByFields:layer.fields.join(','),
  };
}
function regionPlace(code: string): BoundaryPlace {
  const region = canonicalRegion(code), name = regionNames[region] || region;
  return { id:region, level:'region', name, region, province:'', municipality:'', label: name === region ? name : `${name} (${region})` };
}
async function searchRegions(query: string, signal?: AbortSignal): Promise<BoundaryPlace[]> {
  const words = normalizePlaceQuery(query).split(' ').filter(Boolean);
  if (!words.length || words.length > 12 || query.length > 120) throw new Error('Enter a place name of up to 120 characters.');
  const json = await queryLayer('municipality', { f:'json',where:'1=1',outFields:'REGION',returnGeometry:'false',returnDistinctValues:'true',orderByFields:'REGION' }, signal);
  const codes = new Set<string>(json.features.map((f: any) => (f.attributes || f.properties)?.REGION).filter((s: unknown) => typeof s === 'string'));
  return [...codes].map(regionPlace).filter(place => {
    const search = normalizePlaceQuery(`${place.label} ${regionAliases[place.region] || ''}`);
    return words.every(word => search.includes(word));
  });
}
export async function searchPlaces(query: string, level: PlaceLevel | 'all', signal?: AbortSignal): Promise<{places:BoundaryPlace[];partial:boolean}> {
  const requested = level === 'all' ? ['region','province','municipality','barangay'] as PlaceLevel[] : [level];
  const results = await Promise.allSettled(requested.map(async kind => {
    if (kind === 'region') return searchRegions(query, signal);
    const json = await queryLayer(kind,groupedPlaces(kind,placeWhere(query,kind),12),signal);
    return json.features.map((feature: any) => placeFromProperties(feature.attributes || feature.properties, kind)).filter((place: BoundaryPlace | null): place is BoundaryPlace => !!place);
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
    const level = place.level === 'region' ? 'province' : place.level;
    const selector = {where:boundaryWhere(place),resultRecordCount:'2000'};
    const json = await queryLayer(level,{...selector,outFields:layers[level].key,returnGeometry:'true',geometryPrecision:'6',maxAllowableOffset:offset},signal);
    if (!json.features.length || json.exceededTransferLimit) throw new Error('The complete boundary is unavailable. Search again.');
    try {
      const geometry = boundaryGeometry({type:'MultiPolygon',coordinates:json.features.flatMap((f: any) => f.geometry?.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry?.type === 'MultiPolygon' ? f.geometry.coordinates : (() => { throw new Error('No area boundary is available for this place.'); })())});
      const detail = offset === '0.00005' ? '' : ` Coastline detail simplified with a tolerance of approximately ${offset === '0.0005' ? '55' : '220'} metres.`;
      return {...geometry,source:{label:boundarySource,url:boundarySourceUrl,recordId:placeKey(place),level:place.level,name:place.name,region:place.region,province:place.province,municipality:place.municipality,note:boundaryNote+(place.level === 'region' ? ' Regional outline combines the source province boundaries.' : '')+detail}};
    } catch(error) {
      if (offset === '0.002' || !(error instanceof Error) || !/too detailed|no usable polygon/.test(error.message)) throw error;
    }
  }
  throw new Error('Unable to load this boundary. Try again.');
}

const literal = (value: string) => `'${value.replaceAll("'", "''")}'`;
function regionWhere(region: string) {
  if (!region.trim() || region.length > 240) throw new Error('This saved area has no region reference. Search for it again.');
  return canonicalRegion(region) === 'BARMM' ? "REGION IN ('ARMM','BARMM')" : `REGION = ${literal(region)}`;
}
function boundaryWhere(place: BoundaryPlace) {
  const conditions = [regionWhere(place.region)];
  if (place.level === 'region') return conditions[0];
  if (!place.name.trim() || (place.level !== 'province' && !place.province.trim()) || (place.level === 'barangay' && !place.municipality.trim())) throw new Error('This area is missing its parent reference. Search again.');
  conditions.push(`PROVINCE = ${literal(place.level === 'province' ? place.name : place.province)}`);
  if (place.level !== 'province') conditions.push(`CITYMUN = ${literal(place.level === 'municipality' ? place.name : place.municipality)}`);
  if (place.level === 'barangay') conditions.push(`BRGY_NAME = ${literal(place.name)}`);
  return conditions.join(' AND ');
}
export function childLevels(parent: PlaceLevel): LocalPlaceLevel[] {
  return parent === 'region' ? ['province','municipality','barangay'] : parent === 'province' ? ['municipality','barangay'] : parent === 'municipality' ? ['barangay'] : [];
}
export function childPlaceWhere(parent: BoundaryPlace, level: LocalPlaceLevel, query = '') {
  if (!childLevels(parent.level).includes(level)) throw new Error('Choose an area within the selected parent.');
  const conditions = [regionWhere(parent.region)];
  if (parent.level !== 'region') conditions.push(`PROVINCE = ${literal(parent.level === 'province' ? parent.name : parent.province)}`);
  if (parent.level === 'municipality') conditions.push(`CITYMUN = ${literal(parent.name)}`);
  if (query.trim()) conditions.push(`(${placeWhere(query,level)})`);
  return conditions.join(' AND ');
}
export async function listPlaceChildren(parent: BoundaryPlace, level: LocalPlaceLevel, query = '', offset = 0, signal?: AbortSignal) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid area page.');
  const pageSize = 40;
  const json = await queryLayer(level,groupedPlaces(level,childPlaceWhere(parent,level,query),pageSize,offset),signal);
  const places: BoundaryPlace[] = json.features.map((feature: any) => placeFromProperties(feature.attributes || feature.properties,level)).filter(Boolean);
  return {places,nextOffset:offset+json.features.length,hasMore:json.exceededTransferLimit === true || json.features.length === pageSize};
}
export async function resolveBoundaryPlace(geometry: GeofenceGeometry, signal?: AbortSignal): Promise<BoundaryPlace> {
  const source = geometry.source;
  if (!source || source.url !== boundarySourceUrl || !/^(region|province|municipality|barangay)-/.test(source.recordId)) throw new Error('Search for this place again to browse its local areas.');
  const separator = source.recordId.indexOf('-'), level = source.recordId.slice(0,separator) as PlaceLevel, id = source.recordId.slice(separator+1);
  if (level === 'region') return regionPlace(source.region || id);
  if (!/^\d+$/.test(id)) throw new Error('This saved area has no valid boundary reference.');
  if (source.name && source.region) return {id:Number(id),level,name:source.name,region:source.region,province:source.province || '',municipality:source.municipality || '',label:[source.name,source.municipality,source.province].filter(Boolean).join(', ')};
  const layer = layers[level];
  const json = await queryLayer(level,{objectIds:id,outFields:[layer.key,...layer.fields].join(','),returnGeometry:'false'},signal);
  const place = json.features.length === 1 ? placeFromProperties(json.features[0].properties,level) : null;
  if (!place) throw new Error('This saved boundary is no longer available. Search for the area again.');
  return place;
}
