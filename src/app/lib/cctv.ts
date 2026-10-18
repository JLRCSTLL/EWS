export type CameraCategory = 'flood' | 'traffic' | 'accidents';
export type CameraStatus = 'loading' | 'playing' | 'paused' | 'buffering' | 'error';
export interface DemoCamera {
  id: string;
  name: string;
  location: string;
  category: CameraCategory;
  source: 'river' | 'traffic' | 'wet-road';
  offset: number;
  areaId: string;
  metric: { label: string; value: string; unit: string; note: string };
  event?: { title: string; description: string; severity: 'warning' | 'critical'; minutesAgo: number };
}

// Fictional camera assignments and readings. Bundled stock clips illustrate each monitoring use case.
export const demoCameras: DemoCamera[] = [
  { id: 'CAM-01', name: 'Marikina River · East bank', location: 'Marikina City', category: 'flood', source: 'river', offset: 0, areaId: 'demo-marikina',
    metric: { label: 'Water level', value: '3.28', unit: 'm', note: '+0.12 m in the last 15 min' },
    event: { title: 'Rising water level', description: 'Demo water-level threshold exceeded. Review river conditions and the linked alert area.', severity: 'warning', minutesAgo: 2 } },
  { id: 'CAM-02', name: 'EDSA · Northbound', location: 'Quezon City', category: 'traffic', source: 'traffic', offset: 2, areaId: 'demo-qc',
    metric: { label: 'Average speed', value: '18', unit: 'km/h', note: 'Heavy flow · northbound approach' },
    event: { title: 'Traffic building up', description: 'Demo congestion event at the northbound approach. Check access for responding vehicles.', severity: 'warning', minutesAgo: 4 } },
  { id: 'CAM-03', name: 'España · Road incident watch', location: 'Manila', category: 'accidents', source: 'wet-road', offset: 4, areaId: 'demo-manila',
    metric: { label: 'Review status', value: 'Open', unit: '', note: 'Operator verification required' },
    event: { title: 'Possible road obstruction', description: 'Staged accident-monitoring alert. Verify the scene before taking action; the clip does not show a confirmed accident.', severity: 'critical', minutesAgo: 1 } },
  { id: 'CAM-04', name: 'Pasig River · Riverfront', location: 'Manila', category: 'flood', source: 'river', offset: 7, areaId: 'demo-manila',
    metric: { label: 'Water level', value: '1.84', unit: 'm', note: 'Stable · within demo threshold' } },
  { id: 'CAM-05', name: 'Quezon Avenue · Junction', location: 'Quezon City', category: 'traffic', source: 'traffic', offset: 7, areaId: 'demo-qc',
    metric: { label: 'Average speed', value: '36', unit: 'km/h', note: 'Moderate flow · junction clear' } },
  { id: 'CAM-06', name: 'Marikina · Crossing watch', location: 'Marikina City', category: 'accidents', source: 'wet-road', offset: 11, areaId: 'demo-marikina',
    metric: { label: 'Road condition', value: 'Wet', unit: '', note: 'Routine incident watch' } },
];

export const cameraCategoryLabels: Record<CameraCategory, string> = { flood: 'Flood watch', traffic: 'Traffic', accidents: 'Road incidents' };

export function filterCameras(cameras: DemoCamera[], category: CameraCategory | 'all', query: string, attentionOnly: boolean, reviewed: ReadonlySet<string>) {
  const search = query.trim().toLowerCase();
  return cameras.filter(camera => (category === 'all' || camera.category === category)
    && (!attentionOnly || (!!camera.event && !reviewed.has(camera.id)))
    && `${camera.id} ${camera.name} ${camera.location} ${cameraCategoryLabels[camera.category]}`.toLowerCase().includes(search));
}
