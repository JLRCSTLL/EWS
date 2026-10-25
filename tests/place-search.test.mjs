import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryGeometry, normalizePlaceQuery, placeWhere, searchPlaces } from '../src/app/lib/place-search.ts';
import { geofenceArea, getGeofenceError, isAlertGeofence, isPointInGeofence } from '../src/app/lib/geofencing.ts';
const square = (x,y,size) => [[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];

test('administrative outlines retain separate islands and exclude interior holes', () => {
  const geometry = boundaryGeometry({type:'MultiPolygon',coordinates:[[square(121,14,0.1),square(121.02,14.02,0.02)],[square(121.3,14,0.02)]]});
  assert.equal(getGeofenceError(geometry),null);
  assert.equal(isPointInGeofence({lat:14.06,lng:121.06},geometry),true);
  assert.equal(isPointInGeofence({lat:14.03,lng:121.03},geometry),false);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.31},geometry),true);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.2},geometry),false,'gap between islands is not part of the geofence');
  const withoutHole=boundaryGeometry({type:'Polygon',coordinates:[square(121,14,0.1)]});
  assert.ok(geofenceArea(geometry)>0);
  assert.ok(geofenceArea(withoutHole)>geofenceArea(boundaryGeometry({type:'Polygon',coordinates:[square(121,14,0.1),square(121.02,14.02,0.02)]})));
  assert.equal(isAlertGeofence(JSON.parse(JSON.stringify({...geometry,id:'islands',name:'Island province'}))),true);
});
test('boundary search normalizes area types and never inserts raw SQL', () => {
  assert.equal(normalizePlaceQuery('Barangay San Juan, Cainta'),'san juan cainta');
  assert.equal(normalizePlaceQuery('Municipality of Cainta'),'cainta');
  assert.equal(normalizePlaceQuery('Province of Rizal'),'rizal');
  assert.match(placeWhere('San Juan Cainta','barangay'),/UPPER\(CITYMUN\)/);
  assert.doesNotMatch(placeWhere("Rizal'; DROP TABLE users --",'province'),/DROP TABLE|;/);
  assert.throws(()=>placeWhere('', 'barangay'));
});
test('unsupported or malformed area geometry is rejected without inventing a rectangle', () => {
  assert.throws(()=>boundaryGeometry({type:'Point',coordinates:[121,14]}),/No area boundary/);
  assert.throws(()=>boundaryGeometry({type:'Polygon',coordinates:[[[121,14],[121,14],[121,14]]]}));
  assert.ok(getGeofenceError({shape:'boundary',points:[],polygons:[]}));
});
test('all levels are queried; partial failures are exposed and ambiguous results remain separate', async t => {
  const requests=[];
  t.mock.method(globalThis,'fetch',async url => {
    requests.push(String(url));
    if (String(url).includes('/1/query')) throw new Error('offline province service');
    return new Response(JSON.stringify({features:[{properties:String(url).includes('/2/query') ? {OBJECTID:2,CITYMUN:'San Juan',PROVINCE:'Metro Manila'} : {OBJECTID:3,BRGY_NAME:'San Juan',CITYMUN:'Cainta',PROVINCE:'Rizal'}}]}),{status:200});
  });
  const result = await searchPlaces('San Juan','all');
  assert.equal(requests.length,3);
  assert.equal(result.partial,true);
  assert.equal(result.places.length,2);
  assert.notEqual(result.places[0].level,result.places[1].level);
  assert.ok(result.places.some(p=>p.label==='San Juan, Cainta, Rizal'));
});
