"""Build the bundled hospital catalog from the HDX Healthsites Philippines GeoJSON.

Usage: python scripts/import-hospital-catalog.py path/to/philippines.geojson
Requires Shapely. No network request or production database mutation is performed.
"""
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import uuid
from shapely.geometry import shape

source = Path(sys.argv[1])
features = json.loads(source.read_text(encoding='utf-8'))['features']
hospitals, seen = [], {}
excluded = {'unnamed': 0, 'invalid': 0, 'closed': 0, 'duplicate': 0}
for feature in features:
    props = feature['properties']
    if props.get('amenity') != 'hospital' and props.get('healthcare') != 'hospital':
        continue
    name = ' '.join((props.get('name') or '').split())
    if not name:
        excluded['unnamed'] += 1
        continue
    if re.search(r'closed|abandoned|disused|construction|proposed', props.get('operational_status', ''), re.I):
        excluded['closed'] += 1
        continue
    try:
        geometry = shape(feature['geometry'])
        if geometry.is_empty or not geometry.is_valid:
            raise ValueError('Invalid geometry')
        point = geometry.representative_point()
        lat, lng = round(point.y, 6), round(point.x, 6)
        if not (4 <= lat <= 22 and 116 <= lng <= 127):
            raise ValueError('Outside Philippine extent')
        source_ref = f"osm:{props['osm_type']}:{int(props['osm_id'])}"
    except (KeyError, ValueError, TypeError):
        excluded['invalid'] += 1
        continue
    norm = re.sub(r'[^\w]', '', name.casefold())
    if any(math.hypot((lat - y) * 111000, (lng - x) * 108000) < 120 for y, x in seen.get(norm, [])):
        excluded['duplicate'] += 1
        continue
    seen.setdefault(norm, []).append((lat, lng))
    address = ', '.join(str(props[key]).strip() for key in ['addr_housenumber', 'addr_street', 'addr_city', 'addr_postcode'] if props.get(key))
    hospitals.append({
        'id': str(uuid.uuid5(uuid.NAMESPACE_URL, 'https://www.openstreetmap.org/' + source_ref[4:].replace(':', '/'))),
        'name': name[:120], 'location': {'lat': lat, 'lng': lng, 'label': name[:120]},
        'source_ref': source_ref,
        'source_data': {'address': address, 'sourceUrl': 'https://www.openstreetmap.org/' + source_ref[4:].replace(':', '/'),
                        'emergency': props.get('emergency', ''), 'geometry': geometry.geom_type,
                        'updatedAt': props.get('changeset_timestamp'), 'verification': 'Mapped · receiving capability unverified'},
    })
catalog = {
    'version': 'ph-healthsites-2026-09-29-v1', 'source': 'OpenStreetMap contributors / Healthsites',
    'sourceUrl': 'https://data.humdata.org/dataset/philippines-healthsites',
    'license': 'ODbL 1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/',
    'snapshotDate': '2026-09-29', 'retrievedDate': '2026-11-08',
    'sourceSha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'excluded': excluded, 'hospitals': sorted(hospitals, key=lambda h: (h['name'].casefold(), h['id'])),
}
target = Path(__file__).resolve().parents[1] / 'server/data/philippines-hospitals.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(catalog, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
print(json.dumps({'hospitals': len(hospitals), 'excluded': excluded, 'output': str(target)}))
