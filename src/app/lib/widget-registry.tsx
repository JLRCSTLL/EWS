import type { ComponentType, ReactNode } from 'react';
import { Activity, AlertTriangle, FileText, MessageSquare, Shield, Users } from 'lucide-react';
import type { AuditLogEntry, DashboardMessage } from './dashboard-data';
import { AuditLogs } from '../components/AuditLogs';
import { MessageHistory } from '../components/MessageHistory';
import { MessagingPanel, type OutboundMessageDraft } from '../components/MessagingPanel';
import { ResponderDeployment } from '../components/ResponderDeployment';
import { RiskMonitoring } from '../components/RiskMonitoring';
import { SystemHealth } from '../components/SystemHealth';
import { UserManagement } from '../components/UserManagement';
import { DisasterFeedWidget } from '../components/widgets/DisasterFeedWidget';
import { TacticalMapWidget } from '../components/widgets/TacticalMapWidget';

export interface WidgetRuntimeProps {
  auditLogs: AuditLogEntry[];
  messages: DashboardMessage[];
  onSendMessage: (draft: OutboundMessageDraft) => void;
  pendingCount: number;
}

export interface WidgetDefinition {
  title: string;
  libraryTitle: string;
  description: string;
  icon: ReactNode;
  headerColor: string;
  defaultSize: {
    w: number;
    h: number;
  };
  minSize: {
    w: number;
    h: number;
  };
  component: ComponentType<WidgetRuntimeProps>;
}

function EmbeddedWidgetPanel({ children }: { children: ReactNode }) {
  return <div className="embedded-widget-panel h-full min-h-0 min-w-0">{children}</div>;
}

const RiskAnalysisWidget = () => (
  <EmbeddedWidgetPanel>
    <RiskMonitoring />
  </EmbeddedWidgetPanel>
);
const ResponderDeploymentWidget = () => (
  <EmbeddedWidgetPanel>
    <ResponderDeployment />
  </EmbeddedWidgetPanel>
);
const SystemHealthWidget = () => (
  <EmbeddedWidgetPanel>
    <SystemHealth />
  </EmbeddedWidgetPanel>
);
const BroadcastControlWidget = ({ onSendMessage, pendingCount }: WidgetRuntimeProps) => (
  <EmbeddedWidgetPanel>
    <MessagingPanel onSendMessage={onSendMessage} pendingCount={pendingCount} />
  </EmbeddedWidgetPanel>
);
const MessageHistoryWidget = ({ messages }: WidgetRuntimeProps) => (
  <EmbeddedWidgetPanel>
    <MessageHistory messages={messages} />
  </EmbeddedWidgetPanel>
);
const AuditLogsWidget = ({ auditLogs }: WidgetRuntimeProps) => (
  <EmbeddedWidgetPanel>
    <AuditLogs logs={auditLogs} />
  </EmbeddedWidgetPanel>
);
const UserManagementWidget = () => (
  <EmbeddedWidgetPanel>
    <UserManagement />
  </EmbeddedWidgetPanel>
);

export const WIDGETS = {
  map: {
    title: 'TACTICAL MAP DISPLAY',
    libraryTitle: 'Tactical Map',
    description: 'Map, markers, layers, and geofence tools.',
    icon: <Shield className="h-4 w-4 text-cyan-400" />,
    headerColor: 'text-cyan-400',
    defaultSize: { w: 6, h: 6 },
    minSize: { w: 4, h: 4 },
    component: TacticalMapWidget,
  },
  'disaster-feed': {
    title: 'DISASTER EVENT FEED',
    libraryTitle: 'Disaster Feed',
    description: 'Live incident stream and impact details.',
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    headerColor: 'text-red-400',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: DisasterFeedWidget,
  },
  'risk-monitoring': {
    title: 'RISK ANALYSIS',
    libraryTitle: 'Risk Analysis',
    description: 'Risk areas, exposure, and vulnerability signals.',
    icon: <Shield className="h-4 w-4 text-orange-400" />,
    headerColor: 'text-orange-400',
    defaultSize: { w: 3, h: 4 },
    minSize: { w: 2, h: 3 },
    component: RiskAnalysisWidget,
  },
  responders: {
    title: 'RESPONDER DEPLOYMENT',
    libraryTitle: 'Responder Deployment',
    description: 'Team status, deployment, and field locations.',
    icon: <Users className="h-4 w-4 text-green-400" />,
    headerColor: 'text-green-400',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 3 },
    component: ResponderDeploymentWidget,
  },
  'system-health': {
    title: 'SYSTEM HEALTH',
    libraryTitle: 'System Health',
    description: 'Network, service, and infrastructure telemetry.',
    icon: <Activity className="h-4 w-4 text-green-400" />,
    headerColor: 'text-green-400',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 2 },
    component: SystemHealthWidget,
  },
  messaging: {
    title: 'BROADCAST CONTROL',
    libraryTitle: 'Broadcast Control',
    description: 'Targeted emergency broadcast controls.',
    icon: <MessageSquare className="h-4 w-4 text-purple-400" />,
    headerColor: 'text-purple-400',
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 2, h: 3 },
    component: BroadcastControlWidget,
  },
  'message-history': {
    title: 'MESSAGE HISTORY',
    libraryTitle: 'Message History',
    description: 'Recent outgoing message delivery history.',
    icon: <MessageSquare className="h-4 w-4 text-purple-400" />,
    headerColor: 'text-purple-400',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 3, h: 3 },
    component: MessageHistoryWidget,
  },
  'audit-logs': {
    title: 'AUDIT LOGS',
    libraryTitle: 'Audit Logs',
    description: 'System actions and configuration history.',
    icon: <FileText className="h-4 w-4 text-cyan-400" />,
    headerColor: 'text-cyan-400',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 2 },
    component: AuditLogsWidget,
  },
  'user-management': {
    title: 'USER MANAGEMENT (RBAC)',
    libraryTitle: 'User Management (RBAC)',
    description: 'Operator roles, access, and account status.',
    icon: <Users className="h-4 w-4 text-blue-400" />,
    headerColor: 'text-blue-400',
    defaultSize: { w: 4, h: 3 },
    minSize: { w: 2, h: 3 },
    component: UserManagementWidget,
  },
} as const satisfies Record<string, WidgetDefinition>;

export type WidgetId = keyof typeof WIDGETS;

export const allWidgetIds = Object.keys(WIDGETS) as WidgetId[];
