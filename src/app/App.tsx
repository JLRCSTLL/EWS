import { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, FileText, Layout as LayoutIcon, MessageSquare, RotateCcw, Save, Shield, Users } from 'lucide-react';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout/legacy';
import { Toaster, toast } from 'sonner';
import {
  disasterEvents,
  geoFenceOptions,
  initialAuditLogs,
  initialMessages,
  riskAreas,
  targetGroups,
  type AuditLogEntry,
} from './lib/dashboard-data';
import { formatSystemClock } from './lib/formatting';
import { AuditLogs } from './components/AuditLogs';
import { DashboardWidget } from './components/DashboardWidget';
import { DisasterEventFeed } from './components/DisasterEventFeed';
import { MessageHistory } from './components/MessageHistory';
import { MessagingPanel, type OutboundMessageDraft } from './components/MessagingPanel';
import { ResponderDeployment } from './components/ResponderDeployment';
import { RiskMonitoring } from './components/RiskMonitoring';
import { SystemHealth } from './components/SystemHealth';
import { UserManagement } from './components/UserManagement';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);
const ImprovedMapPanel = lazy(() =>
  import('./components/ImprovedMapPanel').then((module) => ({ default: module.ImprovedMapPanel })),
);

type GridLayouts = Record<string, Layout[]>;

const PRESET_LAYOUTS = {
  'soc-layout': {
    name: 'SOC Layout',
    description: 'Security Operations Center',
    layouts: {
      lg: [
        { i: 'map', x: 2, y: 0, w: 6, h: 8, minW: 4, minH: 6 },
        { i: 'disaster-feed', x: 0, y: 0, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'risk-monitoring', x: 0, y: 4, w: 2, h: 4, minW: 2, minH: 3 },
        { i: 'responders', x: 8, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'system-health', x: 8, y: 4, w: 4, h: 4, minW: 3, minH: 3 },
        { i: 'messaging', x: 0, y: 8, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'audit-logs', x: 4, y: 8, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'user-management', x: 8, y: 8, w: 4, h: 4, minW: 2, minH: 3 },
      ],
    },
  },
  'disaster-monitoring': {
    name: 'Disaster Monitoring',
    description: 'Focus on disaster events and response',
    layouts: {
      lg: [
        { i: 'map', x: 0, y: 0, w: 8, h: 8, minW: 4, minH: 6 },
        { i: 'disaster-feed', x: 8, y: 0, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'risk-monitoring', x: 8, y: 4, w: 4, h: 4, minW: 2, minH: 3 },
        { i: 'responders', x: 0, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'message-history', x: 6, y: 8, w: 6, h: 4, minW: 3, minH: 3 },
      ],
    },
  },
  'messaging-broadcast': {
    name: 'Messaging Broadcast',
    description: 'Communication and messaging focus',
    layouts: {
      lg: [
        { i: 'map', x: 0, y: 0, w: 6, h: 6, minW: 4, minH: 4 },
        { i: 'messaging', x: 6, y: 0, w: 6, h: 6, minW: 3, minH: 4 },
        { i: 'message-history', x: 0, y: 6, w: 6, h: 6, minW: 3, minH: 3 },
        { i: 'disaster-feed', x: 6, y: 6, w: 3, h: 6, minW: 2, minH: 3 },
        { i: 'user-management', x: 9, y: 6, w: 3, h: 6, minW: 2, minH: 3 },
      ],
    },
  },
  'analytics-layout': {
    name: 'Analytics Layout',
    description: 'Data analysis and system monitoring',
    layouts: {
      lg: [
        { i: 'system-health', x: 0, y: 0, w: 12, h: 4, minW: 6, minH: 3 },
        { i: 'map', x: 0, y: 4, w: 6, h: 6, minW: 4, minH: 4 },
        { i: 'risk-monitoring', x: 6, y: 4, w: 3, h: 6, minW: 2, minH: 3 },
        { i: 'responders', x: 9, y: 4, w: 3, h: 6, minW: 2, minH: 3 },
        { i: 'audit-logs', x: 0, y: 10, w: 6, h: 4, minW: 3, minH: 3 },
        { i: 'user-management', x: 6, y: 10, w: 6, h: 4, minW: 3, minH: 3 },
      ],
    },
  },
  'video-wall-4x8': {
    name: 'Video Wall 4x8',
    description: 'Optimized for 4x8 screen array',
    layouts: {
      lg: [
        { i: 'disaster-feed', x: 0, y: 0, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'risk-monitoring', x: 2, y: 0, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'map', x: 4, y: 0, w: 6, h: 6, minW: 4, minH: 6 },
        { i: 'messaging', x: 10, y: 0, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'responders', x: 0, y: 3, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'message-history', x: 2, y: 3, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'user-management', x: 10, y: 3, w: 2, h: 3, minW: 2, minH: 3 },
        { i: 'system-health', x: 0, y: 6, w: 8, h: 3, minW: 4, minH: 2 },
        { i: 'audit-logs', x: 8, y: 6, w: 4, h: 3, minW: 2, minH: 2 },
      ],
    },
  },
} as const;

type PresetKey = keyof typeof PRESET_LAYOUTS;
type SavedLayouts = Partial<Record<PresetKey, GridLayouts>>;

const STORAGE_KEYS = {
  preset: 'ecc-dashboard-preset',
  layouts: 'ecc-dashboard-layouts',
  messages: 'ecc-dashboard-messages',
  auditLogs: 'ecc-dashboard-audit-logs',
} as const;

const widgetDefinitions = {
  map: {
    title: 'TACTICAL MAP DISPLAY',
    icon: <Shield className="h-4 w-4 text-cyan-400" />,
    headerColor: 'text-cyan-400',
  },
  'disaster-feed': {
    title: 'DISASTER EVENT FEED',
    icon: <AlertTriangle className="h-4 w-4 text-red-400" />,
    headerColor: 'text-red-400',
  },
  'risk-monitoring': {
    title: 'RISK AND VULNERABILITY',
    icon: <Shield className="h-4 w-4 text-orange-400" />,
    headerColor: 'text-orange-400',
  },
  responders: {
    title: 'RESPONDER DEPLOYMENT',
    icon: <Users className="h-4 w-4 text-green-400" />,
    headerColor: 'text-green-400',
  },
  messaging: {
    title: 'BROADCAST CONTROL',
    icon: <MessageSquare className="h-4 w-4 text-purple-400" />,
    headerColor: 'text-purple-400',
  },
  'message-history': {
    title: 'MESSAGE HISTORY',
    icon: <MessageSquare className="h-4 w-4 text-purple-400" />,
    headerColor: 'text-purple-400',
  },
  'user-management': {
    title: 'USER MANAGEMENT (RBAC)',
    icon: <Users className="h-4 w-4 text-blue-400" />,
    headerColor: 'text-blue-400',
  },
  'audit-logs': {
    title: 'AUDIT LOGS',
    icon: <FileText className="h-4 w-4 text-cyan-400" />,
    headerColor: 'text-cyan-400',
  },
  'system-health': {
    title: 'SYSTEM HEALTH',
    icon: <Activity className="h-4 w-4 text-green-400" />,
    headerColor: 'text-green-400',
  },
} as const;

type WidgetId = keyof typeof widgetDefinitions;

function cloneLayouts(layouts: GridLayouts) {
  return JSON.parse(JSON.stringify(layouts)) as GridLayouts;
}

function readStoredJson<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function getStoredPreset(): PresetKey {
  if (typeof window === 'undefined') {
    return 'soc-layout';
  }

  const preset = window.localStorage.getItem(STORAGE_KEYS.preset);
  if (preset && preset in PRESET_LAYOUTS) {
    return preset as PresetKey;
  }

  return 'soc-layout';
}

function getPresetLayouts(preset: PresetKey) {
  const savedLayouts = readStoredJson<SavedLayouts>(STORAGE_KEYS.layouts, {});
  const storedLayout = savedLayouts[preset];

  return storedLayout ? cloneLayouts(storedLayout) : cloneLayouts(PRESET_LAYOUTS[preset].layouts as unknown as GridLayouts);
}

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function ClockChip() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <div className="rounded border border-cyan-900/30 bg-slate-900/50 px-3 py-1 font-mono text-xs text-cyan-400/70">
      {formatSystemClock(now)}
    </div>
  );
}

function MapLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <div className="rounded border border-cyan-900/30 bg-slate-900/60 px-4 py-3 font-mono text-xs tracking-wider text-cyan-400">
        LOADING TACTICAL MAP...
      </div>
    </div>
  );
}

export default function App() {
  const [layoutMode, setLayoutMode] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<PresetKey>(() => getStoredPreset());
  const [layouts, setLayouts] = useState<GridLayouts>(() => getPresetLayouts(getStoredPreset()));
  const [maximizedWidget, setMaximizedWidget] = useState<WidgetId | null>(null);
  const [messages, setMessages] = useState(() => readStoredJson(STORAGE_KEYS.messages, initialMessages));
  const [auditLogs, setAuditLogs] = useState(() => readStoredJson(STORAGE_KEYS.auditLogs, initialAuditLogs));

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.preset, currentPreset);
  }, [currentPreset]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(auditLogs));
  }, [auditLogs]);

  const appendAuditLog = useCallback((entry: Omit<AuditLogEntry, 'id' | 'createdAt'>) => {
    setAuditLogs((currentLogs) => [
      {
        ...entry,
        id: createId('audit'),
        createdAt: new Date().toISOString(),
      },
      ...currentLogs,
    ].slice(0, 60));
  }, []);

  const handleLayoutChange = useCallback(
    (_layout: Layout[], allLayouts: GridLayouts) => {
      if (layoutMode) {
        setLayouts(allLayouts);
      }
    },
    [layoutMode],
  );

  const handlePresetChange = (preset: string) => {
    if (!(preset in PRESET_LAYOUTS)) {
      return;
    }

    const nextPreset = preset as PresetKey;
    setCurrentPreset(nextPreset);
    setLayouts(getPresetLayouts(nextPreset));
    setLayoutMode(false);
    toast.info(`Loaded ${PRESET_LAYOUTS[nextPreset].name}`);
  };

  const handleSaveLayout = () => {
    const savedLayouts = readStoredJson<SavedLayouts>(STORAGE_KEYS.layouts, {});
    const nextLayouts = { ...savedLayouts, [currentPreset]: cloneLayouts(layouts) };

    window.localStorage.setItem(STORAGE_KEYS.layouts, JSON.stringify(nextLayouts));
    setLayoutMode(false);
    appendAuditLog({
      type: 'config',
      action: 'Dashboard Layout Saved',
      user: 'Command Center Alpha',
      details: `Saved ${PRESET_LAYOUTS[currentPreset].name} layout profile.`,
      severity: 'info',
    });
    toast.success('Layout saved', {
      description: `${PRESET_LAYOUTS[currentPreset].name} is persisted on this workstation.`,
    });
  };

  const handleResetLayout = () => {
    const nextLayouts = readStoredJson<SavedLayouts>(STORAGE_KEYS.layouts, {});
    delete nextLayouts[currentPreset];
    window.localStorage.setItem(STORAGE_KEYS.layouts, JSON.stringify(nextLayouts));

    setLayouts(getPresetLayouts(currentPreset));
    setLayoutMode(false);
    appendAuditLog({
      type: 'config',
      action: 'Dashboard Layout Reset',
      user: 'Command Center Alpha',
      details: `Reset ${PRESET_LAYOUTS[currentPreset].name} layout to the system default.`,
      severity: 'warning',
    });
    toast.info('Layout reset', {
      description: `${PRESET_LAYOUTS[currentPreset].name} has been restored to its default arrangement.`,
    });
  };

  const handleSendMessage = useCallback(
    (draft: OutboundMessageDraft) => {
      const targetGroup = targetGroups.find((group) => group.id === draft.targetGroupId) ?? targetGroups[0];
      const geoFence = geoFenceOptions.find((option) => option.id === draft.geoFenceId) ?? geoFenceOptions[0];
      const recipients = Math.max(1, Math.round(targetGroup.audience * geoFence.coverage));

      const queuedMessage = {
        id: createId('msg'),
        content: draft.content,
        sender: 'Command Center Alpha',
        category: draft.category,
        targetGroup: `${targetGroup.label} | ${geoFence.label}`,
        priority: draft.priority,
        status: 'sending' as const,
        createdAt: new Date().toISOString(),
        recipients,
      };

      setMessages((currentMessages) => [queuedMessage, ...currentMessages].slice(0, 60));
      appendAuditLog({
        type: 'system',
        action: 'Broadcast Queued',
        user: 'Command Center Alpha',
        details: `${draft.priority.toUpperCase()} broadcast queued for ${targetGroup.label} in ${geoFence.label}.`,
        severity: draft.priority === 'critical' ? 'critical' : draft.priority === 'high' ? 'warning' : 'info',
      });

      toast.success('Broadcast queued', {
        description: `${targetGroup.label} | ${recipients.toLocaleString()} recipients`,
      });

      window.setTimeout(() => {
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === queuedMessage.id ? { ...message, status: 'delivered' as const } : message,
          ),
        );

        setAuditLogs((currentLogs) => [
          {
            id: createId('audit'),
            type: 'system',
            action: 'Broadcast Delivered',
            user: 'Command Center Alpha',
            details: `${draft.category} broadcast delivered to ${targetGroup.label} in ${geoFence.label}.`,
            createdAt: new Date().toISOString(),
            severity: 'info',
          },
          ...currentLogs,
        ].slice(0, 60));

        toast.success('Broadcast delivered', {
          description: `${targetGroup.label} receipt confirmed.`,
        });
      }, draft.priority === 'critical' ? 900 : 1400);
    },
    [appendAuditLog],
  );

  const renderWidgetContent = (widgetId: WidgetId) => {
    switch (widgetId) {
      case 'map':
        return (
          <Suspense fallback={<MapLoadingState />}>
            <ImprovedMapPanel />
          </Suspense>
        );
      case 'disaster-feed':
        return <DisasterEventFeed />;
      case 'risk-monitoring':
        return <RiskMonitoring />;
      case 'responders':
        return <ResponderDeployment />;
      case 'messaging':
        return <MessagingPanel onSendMessage={handleSendMessage} pendingCount={messages.filter((message) => message.status === 'sending').length} />;
      case 'message-history':
        return <MessageHistory messages={messages} />;
      case 'user-management':
        return <UserManagement />;
      case 'audit-logs':
        return <AuditLogs logs={auditLogs} />;
      case 'system-health':
        return <SystemHealth />;
      default:
        return null;
    }
  };

  const activeAlerts = disasterEvents.filter((event) => event.severity === 'critical' || event.severity === 'high').length;
  const pendingBroadcasts = messages.filter((message) => message.status === 'sending').length;
  const criticalRiskAreas = riskAreas.filter((area) => area.status === 'critical').length;
  const riskPosture = criticalRiskAreas > 0 ? 'CRITICAL' : activeAlerts > 0 ? 'HIGH' : 'ELEVATED';
  const visibleWidgetIds = Array.from(
    new Set(
      Object.values(layouts).flatMap((breakpointLayouts) => breakpointLayouts.map((item) => item.i)),
    ),
  ).filter((widgetId): widgetId is WidgetId => widgetId in widgetDefinitions);

  if (maximizedWidget) {
    const widget = widgetDefinitions[maximizedWidget];

    return (
      <div className="fixed inset-0 z-50 bg-black">
        <DashboardWidget
          title={widget.title}
          icon={widget.icon}
          headerColor={widget.headerColor}
          isMaximized
          onMinimize={() => setMaximizedWidget(null)}
          className="h-full"
        >
          {renderWidgetContent(maximizedWidget)}
        </DashboardWidget>
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-black text-slate-200">
      <div className="border-b-2 border-cyan-900/50 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-2 shadow-lg shadow-cyan-900/20">
        <div className="flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="rounded bg-gradient-to-br from-cyan-500 to-blue-600 p-2 shadow-lg shadow-cyan-500/50">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-mono tracking-widest text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                EMERGENCY COMMAND CENTER
              </h1>
              <p className="text-[10px] font-mono tracking-wider text-slate-500">
                MODULAR DASHBOARD SYSTEM | DRAGGABLE AND RESIZABLE WIDGETS
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={currentPreset} onValueChange={handlePresetChange}>
              <SelectTrigger className="h-8 w-[220px] border-cyan-900/30 bg-slate-800 text-xs text-slate-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-cyan-900/30 bg-slate-800">
                {(Object.entries(PRESET_LAYOUTS) as [PresetKey, (typeof PRESET_LAYOUTS)[PresetKey]][]).map(([key, layout]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    <div>
                      <div className="text-slate-200">{layout.name}</div>
                      <div className="text-[10px] text-slate-500">{layout.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant={layoutMode ? 'default' : 'outline'}
              size="sm"
              className="h-8 gap-2"
              onClick={() => setLayoutMode((current) => !current)}
            >
              <LayoutIcon className="h-4 w-4" />
              <span className="text-xs">{layoutMode ? 'Lock Layout' : 'Edit Layout'}</span>
            </Button>

            {layoutMode && (
              <>
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleSaveLayout}>
                  <Save className="h-4 w-4" />
                  <span className="text-xs">Save</span>
                </Button>
                <Button variant="outline" size="sm" className="h-8 gap-2" onClick={handleResetLayout}>
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-xs">Reset</span>
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded border border-red-900/50 bg-red-950/30 px-3 py-1">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
              <span className="font-mono text-xs text-red-400">ACTIVE ALERTS: {activeAlerts}</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-orange-900/50 bg-orange-950/30 px-3 py-1">
              <AlertTriangle className="h-4 w-4 text-orange-400" />
              <span className="font-mono text-xs text-orange-400">RISK: {riskPosture}</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-purple-900/50 bg-purple-950/20 px-3 py-1">
              <MessageSquare className="h-4 w-4 text-purple-400" />
              <span className="font-mono text-xs text-purple-400">QUEUE: {pendingBroadcasts}</span>
            </div>
            <ClockChip />
          </div>
        </div>
      </div>

      <div className="p-3" style={{ height: 'calc(100vh - 64px)' }}>
        <ResponsiveGridLayout
          className="layout"
          layouts={layouts}
          breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
          cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
          rowHeight={80}
          isDraggable={layoutMode}
          isResizable={layoutMode}
          onLayoutChange={handleLayoutChange}
          draggableHandle=".drag-handle"
          compactType="vertical"
          margin={[12, 12]}
        >
          {visibleWidgetIds.map((widgetId) => {
            const widget = widgetDefinitions[widgetId];

            return (
              <div key={widgetId} className="dashboard-item">
                <DashboardWidget
                  title={widget.title}
                  icon={widget.icon}
                  headerColor={widget.headerColor}
                  onMaximize={() => setMaximizedWidget(widgetId)}
                >
                  {renderWidgetContent(widgetId)}
                </DashboardWidget>
              </div>
            );
          })}
        </ResponsiveGridLayout>
      </div>

      {layoutMode && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border-2 border-cyan-500/50 bg-cyan-900/90 px-6 py-3 font-mono text-sm text-cyan-100 shadow-[0_0_30px_rgba(6,182,212,0.5)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <LayoutIcon className="h-5 w-5 animate-pulse" />
            <span>LAYOUT EDIT MODE ACTIVE | Drag widgets to reposition and resize from corners</span>
          </div>
        </div>
      )}

      <Toaster position="top-right" richColors closeButton theme="dark" />
    </div>
  );
}
