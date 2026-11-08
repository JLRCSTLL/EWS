import test from 'node:test';
import assert from 'node:assert/strict';
import { addBoundaryGeofences } from '../src/app/lib/boundary-selection.ts';
import { boundarySourceUrl, childPlaceWhere, listPlaceChildren, loadPlaceBoundary, resolveBoundaryPlace, searchPlaces } from '../src/app/lib/place-search.ts';
import { isPointInGeofence } from '../src/app/lib/geofencing.ts';

const parent={id:1,level:'province',name:'Rizal',province:'',municipality:'',region:'IV-A',label:'Rizal'};
const city={id:2,level:'municipality',name:'Cainta',province:'Rizal',municipality:'',region:'IV-A',label:'Cainta, Rizal'};
const square=(x,y,size)=>[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]];
const response=body=>new Response(JSON.stringify(body),{status:200});

test('local-area filters stay inside their exact parent even for repeated or quoted names',()=>{
  assert.equal(childPlaceWhere(parent,'municipality'),"REGION = 'IV-A' AND PROVINCE = 'Rizal'");
  assert.match(childPlaceWhere(city,'barangay','San Juan'),/PROVINCE = 'Rizal' AND CITYMUN = 'Cainta'/);
  assert.match(childPlaceWhere({...city,name:"D'Angelo"},'barangay'),/CITYMUN = 'D''Angelo'/);
  assert.throws(()=>childPlaceWhere(city,'province'),/within/);
  assert.throws(()=>childPlaceWhere({...parent,region:''},'barangay'),/region reference/);
  assert.match(childPlaceWhere({id:'BARMM',level:'region',region:'BARMM'},'municipality'),/REGION IN \('ARMM','BARMM'\)/);
});

test('local lists load further pages and retain duplicate names from different municipalities',async t=>{
  const requests=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);requests.push(url);
    return response({exceededTransferLimit:url.searchParams.get('resultOffset')==='0',features:[
      {attributes:{boundary_id:10,BRGY_NAME:'San Juan',CITYMUN:'Cainta',PROVINCE:'Rizal',REGION:'IV-A'}},
      {attributes:{boundary_id:11,BRGY_NAME:'San Juan',CITYMUN:'Taytay',PROVINCE:'Rizal',REGION:'IV-A'}},
    ]});
  });
  const first=await listPlaceChildren(parent,'barangay');
  const next=await listPlaceChildren(parent,'barangay','',first.nextOffset);
  assert.equal(first.hasMore,true);assert.equal(next.hasMore,false);
  assert.equal(requests[1].searchParams.get('resultOffset'),'2');
  assert.equal(requests[0].searchParams.get('returnGeometry'),'false');
  assert.equal(requests[0].searchParams.get('groupByFieldsForStatistics'),'BRGY_NAME,CITYMUN,PROVINCE,REGION');
  assert.equal(JSON.parse(requests[0].searchParams.get('outStatistics'))[0].statisticType,'min');
  assert.match(requests[0].searchParams.get('where'),/PROVINCE = 'Rizal'/);
  assert.notEqual(first.places[0].label,first.places[1].label);
  await assert.rejects(listPlaceChildren(parent,'barangay','',-1),/Invalid area page/);
});

test('an island municipality loads all its source records within the exact parent',async t=>{
  let request;
  t.mock.method(globalThis,'fetch',async input=>{
    request=new URL(input);
    return response({features:[
      {geometry:{type:'Polygon',coordinates:[square(121,14,.1)]}},
      {geometry:{type:'Polygon',coordinates:[square(121.3,14,.02)]}},
    ]});
  });
  const area=await loadPlaceBoundary({...city,name:'Burdeos',province:'Quezon',label:'Burdeos, Quezon'});
  assert.equal(request.searchParams.get('where'),"REGION = 'IV-A' AND PROVINCE = 'Quezon' AND CITYMUN = 'Burdeos'");
  assert.equal(request.searchParams.has('objectIds'),false);
  assert.equal(area.polygons.length,2);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.31},area),true);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.2},area),false);
  t.mock.method(globalThis,'fetch',async()=>response({features:[{geometry:{type:'Polygon',coordinates:[square(121,14,.1)]}}],exceededTransferLimit:true}));
  await assert.rejects(loadPlaceBoundary(city),/complete boundary/);
});

test('regional search recognizes CALABARZON and numbered region aliases from available data',async t=>{
  t.mock.method(globalThis,'fetch',async()=>response({features:[{attributes:{REGION:'IV-A'}},{attributes:{REGION:'NCR'}}]}));
  for(const query of ['CALABARZON','Region 4A','Region IV-A']) {
    const result=await searchPlaces(query,'region');
    assert.equal(result.places.length,1);assert.equal(result.places[0].region,'IV-A');
  }
  assert.equal((await searchPlaces('Metro Manila','region')).places[0].id,'NCR');
});

test('region boundaries preserve province islands and holes instead of inventing a rectangle',async t=>{
  let url;
  t.mock.method(globalThis,'fetch',async input=>{url=new URL(input);return response({features:[
    {geometry:{type:'Polygon',coordinates:[square(121,14,.1),square(121.02,14.02,.02)]}},
    {geometry:{type:'MultiPolygon',coordinates:[[square(121.3,14,.02)]]}},
  ]});});
  const area=await loadPlaceBoundary({id:'IV-A',level:'region',name:'CALABARZON',region:'IV-A',province:'',municipality:'',label:'CALABARZON (IV-A)'});
  assert.match(url.pathname,/\/1\/query$/);assert.equal(url.searchParams.get('where'),"REGION = 'IV-A'");
  assert.equal(area.source.recordId,'region-IV-A');
  assert.equal(isPointInGeofence({lat:14.06,lng:121.06},area),true);
  assert.equal(isPointInGeofence({lat:14.03,lng:121.03},area),false);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.31},area),true);
  assert.equal(isPointInGeofence({lat:14.01,lng:121.2},area),false);
});

test('incomplete regional responses are rejected',async t=>{
  t.mock.method(globalThis,'fetch',async()=>response({exceededTransferLimit:true,features:[{geometry:{type:'Polygon',coordinates:[square(121,14,.1)]}}]}));
  await assert.rejects(loadPlaceBoundary({id:'IV-A',level:'region',name:'CALABARZON',region:'IV-A'}),/complete boundary/);
});

test('older saved geofences recover hierarchy metadata without trusting their display name',async t=>{
  let request;
  t.mock.method(globalThis,'fetch',async input=>{request=new URL(input);return response({features:[{properties:{OBJECTID:2,CITYMUN:'Cainta',PROVINCE:'Rizal',REGION:'IV-A'}}]});});
  const geometry={source:{url:boundarySourceUrl,recordId:'municipality-2',level:'municipality'}};
  assert.equal((await resolveBoundaryPlace(geometry)).label,'Cainta, Rizal');
  assert.equal(request.searchParams.get('objectIds'),'2');
  const abort=new AbortController();abort.abort();
  t.mock.method(globalThis,'fetch',async(_input,init)=>{init.signal.throwIfAborted();});
  await assert.rejects(resolveBoundaryPlace(geometry,abort.signal),{name:'AbortError'});
});

test('saving multiple areas appends separate fences and skips duplicates without altering the parent',async t=>{
  t.mock.method(globalThis,'fetch',async()=>response({features:[{geometry:{type:'Polygon',coordinates:[square(121,14,.1)]}}]}));
  const geometry=await loadPlaceBoundary(city);
  const existing=[{id:'parent',name:'Existing regional area',shape:'rectangle',points:[{lat:13,lng:120},{lat:15,lng:122}]}];
  const original=JSON.stringify(existing);
  const result=addBoundaryGeofences(existing,[{place:city,geometry},{place:city,geometry}],()=> 'new-city');
  assert.equal(result.added,1);assert.equal(result.areas.length,2);assert.equal(JSON.stringify(existing),original);
  assert.equal(result.areas[1].name,'Cainta, Rizal');
  assert.equal(addBoundaryGeofences(result.areas,[{place:city,geometry}]).added,0);
  assert.throws(()=>addBoundaryGeofences(existing,[{place:city,geometry:{shape:'boundary',points:[],polygons:[]}}]));
  assert.equal(existing.length,1);
});
