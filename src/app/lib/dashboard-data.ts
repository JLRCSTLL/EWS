const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type MessagePriority = 'critical' | 'high' | 'normal';
export type MessageStatus = 'delivered' | 'sending' | 'failed';

export interface MessageTemplate {
  id: string;
  label: string;
  category: string;
  content: string;
}

export interface TargetGroup {
  id: string;
  label: string;
  audience: number;
}

export interface GeoFenceOption {
  id: string;
  label: string;
  coverage: number;
}

export interface DashboardMessage {
  id: string;
  content: string;
  sender: string;
  category: string;
  targetGroup: string;
  priority: MessagePriority;
  status: MessageStatus;
  createdAt: string;
  recipients: number;
}

export interface AuditLogEntry {
  id: string;
  type: 'config' | 'user' | 'access' | 'system';
  action: string;
  user: string;
  details: string;
  createdAt: string;
  severity: 'info' | 'warning' | 'critical';
}

export interface DisasterEvent {
  id: string;
  type: 'typhoon' | 'flood' | 'earthquake' | 'landslide' | 'fire';
  severity: Severity;
  title: string;
  location: string;
  source: 'satellite' | 'sensor' | 'report';
  description: string;
  createdAt: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface InfrastructureSite {
  id: string;
  type: 'hospital' | 'shelter' | 'fire-station';
  name: string;
  status: 'operational' | 'at-capacity' | 'offline';
  location: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface ResponderTeam {
  id: string;
  name: string;
  type: string;
  personnel: number;
  location: string;
  status: 'deployed' | 'active' | 'standby' | 'returning';
  deployedAt?: string;
  lastUpdateAt: string;
  lat: number;
  lng: number;
  x: number;
  y: number;
}

export interface RiskArea {
  id: string;
  name: string;
  population: number;
  riskLevel: number;
  vulnerabilities: string[];
  status: Severity;
}

export interface UserAccount {
  id: string;
  name: string;
  role: 'admin' | 'lgu-official' | 'responder' | 'operator';
  organization: string;
  status: 'active' | 'inactive';
  lastActiveAt: string;
  permissions: string[];
}

export interface RoleSummary {
  id: UserAccount['role'];
  label: string;
  count: number;
  color: string;
}

export interface SystemMetric {
  id: string;
  label: string;
  value: number;
  icon: 'cpu' | 'server' | 'storage' | 'network';
  color: string;
  barColor: string;
}

export interface CpuPoint {
  time: string;
  value: number;
}

export interface NetworkPoint {
  time: string;
  inbound: number;
  outbound: number;
}

export interface ServerStatus {
  id: string;
  name: string;
  status: 'online' | 'standby';
  uptime: string;
  load: number;
}

export const messageTemplates: MessageTemplate[] = [
  {
    id: 'template-evacuation',
    label: 'Evacuation Order',
    category: 'Evacuation',
    content: 'IMMEDIATE EVACUATION REQUIRED. Proceed to the nearest designated evacuation center. Bring essential items only.',
  },
  {
    id: 'template-shelter',
    label: 'Shelter In Place',
    category: 'Shelter Order',
    content: 'SHELTER IN PLACE. Stay indoors, secure doors and windows, and await additional instructions from the command center.',
  },
  {
    id: 'template-clear',
    label: 'All Clear',
    category: 'Status Update',
    content: 'ALL CLEAR. Immediate threat conditions have eased. Continue monitoring official channels for follow-on instructions.',
  },
  {
    id: 'template-supply',
    label: 'Supply Distribution',
    category: 'Supply Distribution',
    content: 'Emergency supplies are available at designated distribution points. Bring valid identification for rapid processing.',
  },
  {
    id: 'template-medical',
    label: 'Medical Alert',
    category: 'Medical Alert',
    content: 'Medical assistance is required in affected zones. Proceed to the nearest medical station if symptoms or injuries are present.',
  },
];

export const targetGroups: TargetGroup[] = [
  { id: 'all', label: 'All Citizens', audience: 2_500_000 },
  { id: 'responders', label: 'First Responders', audience: 850 },
  { id: 'lgu', label: 'LGU Officials', audience: 245 },
  { id: 'barangay', label: 'Barangay Leaders', audience: 1_200 },
  { id: 'drrm', label: 'DRRM Council', audience: 120 },
];

export const geoFenceOptions: GeoFenceOption[] = [
  { id: 'all-areas', label: 'All Areas', coverage: 1 },
  { id: 'metro-manila', label: 'Metro Manila', coverage: 0.46 },
  { id: 'quezon-city', label: 'Quezon City', coverage: 0.18 },
  { id: 'makati', label: 'Makati', coverage: 0.06 },
  { id: 'coastal-regions', label: 'Coastal Regions', coverage: 0.22 },
  { id: 'high-risk-zones', label: 'High Risk Zones', coverage: 0.12 },
];

export const initialMessages: DashboardMessage[] = [
  {
    id: 'msg-1',
    content: 'IMMEDIATE EVACUATION REQUIRED. Proceed to the nearest designated evacuation center.',
    sender: 'Command Center Alpha',
    category: 'Evacuation',
    targetGroup: 'Metro Manila | High Risk Zones',
    priority: 'critical',
    status: 'delivered',
    createdAt: minutesAgo(5),
    recipients: 450_000,
  },
  {
    id: 'msg-2',
    content: 'Weather alert: typhoon conditions are intensifying. Secure outdoor items and stay indoors until further notice.',
    sender: 'Weather Monitoring',
    category: 'Weather Alert',
    targetGroup: 'All Citizens | All Areas',
    priority: 'high',
    status: 'delivered',
    createdAt: minutesAgo(15),
    recipients: 2_500_000,
  },
  {
    id: 'msg-3',
    content: 'Emergency supplies distribution begins at Central Evacuation Center at 14:00.',
    sender: 'Relief Operations',
    category: 'Supply Distribution',
    targetGroup: 'Barangay Leaders | Metro Manila',
    priority: 'normal',
    status: 'delivered',
    createdAt: minutesAgo(32),
    recipients: 1_200,
  },
  {
    id: 'msg-4',
    content: 'Medical teams are deploying to affected sectors. Report casualties through responder channels immediately.',
    sender: 'Medical Response',
    category: 'Medical Alert',
    targetGroup: 'First Responders | High Risk Zones',
    priority: 'critical',
    status: 'sending',
    createdAt: minutesAgo(1),
    recipients: 850,
  },
  {
    id: 'msg-5',
    content: 'Road closures are in effect on Main Avenue and River Street. Use designated alternate routes.',
    sender: 'Traffic Management',
    category: 'Traffic Update',
    targetGroup: 'LGU Officials | Metro Manila',
    priority: 'normal',
    status: 'delivered',
    createdAt: hoursAgo(1),
    recipients: 245,
  },
];

export const initialAuditLogs: AuditLogEntry[] = [
  {
    id: 'audit-1',
    type: 'config',
    action: 'System Configuration Changed',
    user: 'Maria Santos',
    details: 'Updated alert threshold levels for flood monitoring.',
    createdAt: minutesAgo(2),
    severity: 'info',
  },
  {
    id: 'audit-2',
    type: 'user',
    action: 'User Role Modified',
    user: 'Juan dela Cruz',
    details: 'Changed role from operator to lgu-official.',
    createdAt: minutesAgo(8),
    severity: 'warning',
  },
  {
    id: 'audit-3',
    type: 'access',
    action: 'Unauthorized Access Attempt',
    user: 'Unknown',
    details: 'Failed login attempt from IP 192.168.1.100.',
    createdAt: minutesAgo(15),
    severity: 'critical',
  },
  {
    id: 'audit-4',
    type: 'system',
    action: 'Broadcast Message Sent',
    user: 'Command Center Alpha',
    details: 'Emergency evacuation order issued to Metro Manila high risk sectors.',
    createdAt: minutesAgo(18),
    severity: 'info',
  },
  {
    id: 'audit-5',
    type: 'config',
    action: 'Map Layer Configuration',
    user: 'Pedro Reyes',
    details: 'Enabled infrastructure overlay layer for tactical map display.',
    createdAt: minutesAgo(25),
    severity: 'info',
  },
  {
    id: 'audit-6',
    type: 'user',
    action: 'User Account Created',
    user: 'Maria Santos',
    details: 'Provisioned operator account for Ana Garcia.',
    createdAt: minutesAgo(32),
    severity: 'info',
  },
  {
    id: 'audit-7',
    type: 'access',
    action: 'Administrative Access',
    user: 'Maria Santos',
    details: 'Accessed system configuration panel.',
    createdAt: minutesAgo(45),
    severity: 'warning',
  },
  {
    id: 'audit-8',
    type: 'system',
    action: 'Database Backup Completed',
    user: 'System',
    details: 'Automated backup completed successfully at 2.3 GB.',
    createdAt: hoursAgo(1),
    severity: 'info',
  },
];

export const disasterEvents: DisasterEvent[] = [
  {
    id: 'event-1',
    type: 'typhoon',
    severity: 'critical',
    title: 'Typhoon Ramon approaching',
    location: 'Metro Manila',
    source: 'satellite',
    description: 'Category 4 typhoon with sustained winds at 185 km/h.',
    createdAt: minutesAgo(2),
    lat: 14.5995,
    lng: 120.9842,
    x: 45,
    y: 35,
  },
  {
    id: 'event-2',
    type: 'flood',
    severity: 'high',
    title: 'Flash flood warning',
    location: 'Quezon City',
    source: 'sensor',
    description: 'Water level is rising rapidly and is 3 meters above normal.',
    createdAt: minutesAgo(5),
    lat: 14.676,
    lng: 121.0437,
    x: 60,
    y: 25,
  },
  {
    id: 'event-3',
    type: 'earthquake',
    severity: 'medium',
    title: 'Seismic activity detected',
    location: 'Makati',
    source: 'sensor',
    description: 'Magnitude 4.2 event registered at 10 km depth.',
    createdAt: minutesAgo(12),
    lat: 14.5547,
    lng: 121.0244,
    x: 55,
    y: 50,
  },
  {
    id: 'event-4',
    type: 'landslide',
    severity: 'high',
    title: 'Landslide risk elevated',
    location: 'Baguio',
    source: 'report',
    description: 'Heavy rainfall is driving slope instability in mountain corridors.',
    createdAt: minutesAgo(18),
    lat: 16.4023,
    lng: 120.596,
    x: 34,
    y: 18,
  },
  {
    id: 'event-5',
    type: 'fire',
    severity: 'medium',
    title: 'Structure fire reported',
    location: 'Pasig City',
    source: 'report',
    description: 'Residential fire incident requiring a 2-alarm response.',
    createdAt: minutesAgo(25),
    lat: 14.5764,
    lng: 121.0851,
    x: 58,
    y: 44,
  },
  {
    id: 'event-6',
    type: 'flood',
    severity: 'low',
    title: 'Rising water levels',
    location: 'Marikina',
    source: 'sensor',
    description: 'Conditions are under monitoring at alert level 1.',
    createdAt: minutesAgo(32),
    lat: 14.6507,
    lng: 121.1029,
    x: 67,
    y: 32,
  },
];

export const infrastructureSites: InfrastructureSite[] = [
  {
    id: 'infra-1',
    type: 'hospital',
    name: 'Manila General Hospital',
    status: 'operational',
    location: 'Ermita, Manila',
    lat: 14.5793,
    lng: 120.9757,
    x: 40,
    y: 45,
  },
  {
    id: 'infra-2',
    type: 'hospital',
    name: 'Medical Center East',
    status: 'at-capacity',
    location: 'Quezon City',
    lat: 14.6091,
    lng: 121.0223,
    x: 55,
    y: 30,
  },
  {
    id: 'infra-3',
    type: 'shelter',
    name: 'Central Evacuation Center',
    status: 'operational',
    location: 'Mandaluyong',
    lat: 14.5794,
    lng: 121.0359,
    x: 65,
    y: 40,
  },
  {
    id: 'infra-4',
    type: 'shelter',
    name: 'North Shelter Complex',
    status: 'operational',
    location: 'Caloocan',
    lat: 14.6617,
    lng: 120.9739,
    x: 48,
    y: 20,
  },
  {
    id: 'infra-5',
    type: 'fire-station',
    name: 'Station 12',
    status: 'operational',
    location: 'Pasig River Sector',
    lat: 14.593,
    lng: 121.0437,
    x: 45,
    y: 35,
  },
];

export const responderTeams: ResponderTeam[] = [
  {
    id: 'team-1',
    name: 'Alpha Team',
    type: 'Search and Rescue',
    personnel: 12,
    location: 'Metro Manila Zone A',
    status: 'deployed',
    deployedAt: minutesAgo(45),
    lastUpdateAt: minutesAgo(2),
    lat: 14.5895,
    lng: 120.9845,
    x: 43,
    y: 42,
  },
  {
    id: 'team-2',
    name: 'Bravo Team',
    type: 'Medical Response',
    personnel: 8,
    location: 'Quezon City Hospital',
    status: 'active',
    lastUpdateAt: minutesAgo(5),
    lat: 14.6107,
    lng: 121.0194,
    x: 53,
    y: 28,
  },
  {
    id: 'team-3',
    name: 'Charlie Team',
    type: 'Fire and Rescue',
    personnel: 15,
    location: 'Pasig River Zone',
    status: 'deployed',
    deployedAt: minutesAgo(80),
    lastUpdateAt: minutesAgo(1),
    lat: 14.5647,
    lng: 121.0344,
    x: 58,
    y: 55,
  },
  {
    id: 'team-4',
    name: 'Delta Team',
    type: 'Evacuation Support',
    personnel: 10,
    location: 'Central Command',
    status: 'standby',
    lastUpdateAt: minutesAgo(10),
    lat: 14.6,
    lng: 121,
    x: 36,
    y: 48,
  },
  {
    id: 'team-5',
    name: 'Echo Team',
    type: 'Search and Rescue',
    personnel: 14,
    location: 'Coastal Region B',
    status: 'deployed',
    deployedAt: minutesAgo(30),
    lastUpdateAt: minutesAgo(3),
    lat: 14.536,
    lng: 120.979,
    x: 72,
    y: 46,
  },
  {
    id: 'team-6',
    name: 'Foxtrot Team',
    type: 'Medical Response',
    personnel: 6,
    location: 'En route to base',
    status: 'returning',
    lastUpdateAt: minutesAgo(5),
    lat: 14.62,
    lng: 121.01,
    x: 50,
    y: 60,
  },
];

export const riskAreas: RiskArea[] = [
  {
    id: 'risk-1',
    name: 'Metro Manila Zone A',
    population: 2_500_000,
    riskLevel: 95,
    vulnerabilities: ['Flood prone', 'Dense population', 'Limited evacuation routes'],
    status: 'critical',
  },
  {
    id: 'risk-2',
    name: 'Quezon City District 3',
    population: 850_000,
    riskLevel: 78,
    vulnerabilities: ['Landslide risk', 'Aging infrastructure'],
    status: 'high',
  },
  {
    id: 'risk-3',
    name: 'Coastal Region B',
    population: 450_000,
    riskLevel: 82,
    vulnerabilities: ['Storm surge', 'Coastal flooding', 'Typhoon exposure'],
    status: 'high',
  },
  {
    id: 'risk-4',
    name: 'Makati Business District',
    population: 600_000,
    riskLevel: 65,
    vulnerabilities: ['High-rise buildings', 'Seismic activity'],
    status: 'medium',
  },
  {
    id: 'risk-5',
    name: 'Pasig River Zone',
    population: 380_000,
    riskLevel: 88,
    vulnerabilities: ['Flood zone', 'Water contamination risk'],
    status: 'critical',
  },
];

export const users: UserAccount[] = [
  {
    id: 'user-1',
    name: 'Maria Santos',
    role: 'admin',
    organization: 'National DRRM Council',
    status: 'active',
    lastActiveAt: minutesAgo(2),
    permissions: ['full-access', 'user-management', 'system-config'],
  },
  {
    id: 'user-2',
    name: 'Juan dela Cruz',
    role: 'lgu-official',
    organization: 'Metro Manila LGU',
    status: 'active',
    lastActiveAt: minutesAgo(5),
    permissions: ['view-data', 'send-messages', 'manage-responders'],
  },
  {
    id: 'user-3',
    name: 'Pedro Reyes',
    role: 'responder',
    organization: 'Alpha Response Team',
    status: 'active',
    lastActiveAt: minutesAgo(1),
    permissions: ['view-assignments', 'update-status'],
  },
  {
    id: 'user-4',
    name: 'Ana Garcia',
    role: 'operator',
    organization: 'Command Center Operations',
    status: 'active',
    lastActiveAt: minutesAgo(3),
    permissions: ['view-data', 'send-messages'],
  },
  {
    id: 'user-5',
    name: 'Carlos Mendez',
    role: 'lgu-official',
    organization: 'Quezon City LGU',
    status: 'inactive',
    lastActiveAt: hoursAgo(2),
    permissions: ['view-data', 'send-messages'],
  },
];

export const roleSummaries: RoleSummary[] = [
  { id: 'admin', label: 'Administrator', count: 3, color: 'text-red-400' },
  { id: 'lgu-official', label: 'LGU Official', count: 45, color: 'text-blue-400' },
  { id: 'responder', label: 'First Responder', count: 120, color: 'text-green-400' },
  { id: 'operator', label: 'Operator', count: 28, color: 'text-purple-400' },
];

export const systemMetrics: SystemMetric[] = [
  { id: 'metric-1', label: 'CPU Usage', value: 68, icon: 'cpu', color: 'text-cyan-400', barColor: 'bg-cyan-500' },
  { id: 'metric-2', label: 'Memory Usage', value: 74, icon: 'server', color: 'text-purple-400', barColor: 'bg-purple-500' },
  { id: 'metric-3', label: 'Storage', value: 45, icon: 'storage', color: 'text-green-400', barColor: 'bg-green-500' },
  { id: 'metric-4', label: 'Network', value: 82, icon: 'network', color: 'text-orange-400', barColor: 'bg-orange-500' },
];

export const cpuData: CpuPoint[] = [
  { time: '00:00', value: 45 },
  { time: '00:05', value: 52 },
  { time: '00:10', value: 48 },
  { time: '00:15', value: 65 },
  { time: '00:20', value: 58 },
  { time: '00:25', value: 72 },
  { time: '00:30', value: 68 },
];

export const networkData: NetworkPoint[] = [
  { time: '00:00', inbound: 120, outbound: 80 },
  { time: '00:05', inbound: 135, outbound: 95 },
  { time: '00:10', inbound: 142, outbound: 88 },
  { time: '00:15', inbound: 158, outbound: 102 },
  { time: '00:20', inbound: 145, outbound: 98 },
  { time: '00:25', inbound: 165, outbound: 110 },
  { time: '00:30', inbound: 152, outbound: 105 },
];

export const servers: ServerStatus[] = [
  { id: 'server-1', name: 'Primary Server', status: 'online', uptime: '99.9%', load: 68 },
  { id: 'server-2', name: 'Database Server', status: 'online', uptime: '99.8%', load: 52 },
  { id: 'server-3', name: 'API Server', status: 'online', uptime: '99.9%', load: 45 },
  { id: 'server-4', name: 'Backup Server', status: 'standby', uptime: '100%', load: 12 },
];
