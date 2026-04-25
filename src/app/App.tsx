import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Layout as LayoutIcon, Library, RotateCcw, Save, Shield, Shrink } from 'lucide-react';
import type { Layout } from 'react-grid-layout/legacy';
import { Toaster, toast } from 'sonner';
import {
  geoFenceOptions,
  initialAuditLogs,
  initialMessages,
  targetGroups,
  type AuditLogEntry,
} from './lib/dashboard-data';
import { formatSystemClock } from './lib/formatting';
import { allWidgetIds, WIDGETS, type WidgetId, type WidgetRuntimeProps } from './lib/widget-registry';
import { DashboardGrid } from './components/DashboardGrid';
import { DashboardWidget } from './components/DashboardWidget';
import type { OutboundMessageDraft } from './components/MessagingPanel';
import { WidgetLibrary } from './components/WidgetLibrary';
import { Button } from './components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './components/ui/select';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

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

const TOOLBAR_BUTTON_CLASS =
  'h-8 gap-2 border-cyan-900/40 bg-slate-900/80 text-cyan-100 hover:bg-cyan-950/50 hover:text-cyan-50';

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

function persistPresetLayouts(preset: PresetKey, layouts: GridLayouts) {
  if (typeof window === 'undefined') {
    return;
  }

  const savedLayouts = readStoredJson<SavedLayouts>(STORAGE_KEYS.layouts, {});
  window.localStorage.setItem(
    STORAGE_KEYS.layouts,
    JSON.stringify({ ...savedLayouts, [preset]: cloneLayouts(layouts) }),
  );
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

function createWidgetLayoutItem(widgetId: WidgetId, layout: Layout[], placement?: Partial<Layout>): Layout {
  const widget = WIDGETS[widgetId];
  const lowestY = layout.reduce((maxY, item) => Math.max(maxY, item.y + item.h), 0);
  const requestedX = placement?.x ?? 0;
  const requestedY = placement?.y ?? lowestY;
  const isRequestedCellOccupied = layout.some((item) => item.x === requestedX && item.y === requestedY);

  return {
    i: widgetId,
    x: requestedX,
    y: isRequestedCellOccupied ? lowestY : requestedY,
    w: placement?.w ?? widget.defaultSize.w,
    h: placement?.h ?? widget.defaultSize.h,
    minW: widget.minSize.w,
    minH: widget.minSize.h,
  };
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

export default function App() {
  const [layoutMode, setLayoutMode] = useState(false);
  const [currentPreset, setCurrentPreset] = useState<PresetKey>(() => getStoredPreset());
  const [layouts, setLayouts] = useState<GridLayouts>(() => getPresetLayouts(getStoredPreset()));
  const [maximizedWidget, setMaximizedWidget] = useState<WidgetId | null>(null);
  const [messages, setMessages] = useState(() => readStoredJson(STORAGE_KEYS.messages, initialMessages));
  const [auditLogs, setAuditLogs] = useState(() => readStoredJson(STORAGE_KEYS.auditLogs, initialAuditLogs));
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(false);
  const [hasLayoutChanges, setHasLayoutChanges] = useState(false);
  const [isWidgetLibraryOpen, setIsWidgetLibraryOpen] = useState(false);
  const [activeDragWidgetId, setActiveDragWidgetId] = useState<WidgetId | null>(null);
  const skipNextLayoutChangeRef = useRef(true);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.preset, currentPreset);
  }, [currentPreset]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.messages, JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.auditLogs, JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    const syncFullscreenState = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    syncFullscreenState();
    document.addEventListener('fullscreenchange', syncFullscreenState);

    return () => {
      document.removeEventListener('fullscreenchange', syncFullscreenState);
    };
  }, []);

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
      if (skipNextLayoutChangeRef.current) {
        skipNextLayoutChangeRef.current = false;
        return;
      }

      setLayouts(allLayouts);
      persistPresetLayouts(currentPreset, allLayouts);
      setHasLayoutChanges(true);
    },
    [currentPreset],
  );

  const handlePresetChange = (preset: string) => {
    if (!(preset in PRESET_LAYOUTS)) {
      return;
    }

    const nextPreset = preset as PresetKey;
    skipNextLayoutChangeRef.current = true;
    setCurrentPreset(nextPreset);
    setLayouts(getPresetLayouts(nextPreset));
    setHasLayoutChanges(false);
    setLayoutMode(false);
    toast.info(`Loaded ${PRESET_LAYOUTS[nextPreset].name}`);
  };

  const handleSaveLayout = () => {
    persistPresetLayouts(currentPreset, layouts);
    setHasLayoutChanges(false);
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

    skipNextLayoutChangeRef.current = true;
    setLayouts(getPresetLayouts(currentPreset));
    setHasLayoutChanges(false);
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

  const handleCloseWidget = (widgetId: WidgetId) => {
    setLayouts((currentLayouts) => {
      const nextLayouts = Object.fromEntries(
        Object.entries(currentLayouts).map(([breakpoint, breakpointLayout]) => [
          breakpoint,
          breakpointLayout.filter((item) => item.i !== widgetId),
        ]),
      ) as GridLayouts;

      persistPresetLayouts(currentPreset, nextLayouts);
      return nextLayouts;
    });
    setMaximizedWidget((currentWidget) => (currentWidget === widgetId ? null : currentWidget));
    setHasLayoutChanges(true);
    toast.info(`${WIDGETS[widgetId].title} hidden`, {
      description: 'Open the widget library to add it back.',
    });
  };

  const handleAddWidget = useCallback(
    (widgetId: WidgetId, placement?: Partial<Layout>) => {
      setActiveDragWidgetId(null);

      const layoutEntries = Object.entries(layouts);
      const safeLayoutEntries = layoutEntries.length > 0 ? layoutEntries : [['lg', [] as Layout[]]];
      const isAlreadyPresentEverywhere = safeLayoutEntries.every(([, breakpointLayout]) =>
        breakpointLayout.some((item) => item.i === widgetId),
      );

      if (isAlreadyPresentEverywhere) {
        toast.info(`${WIDGETS[widgetId].title} is already on the dashboard.`);
        return;
      }

      const nextLayouts = Object.fromEntries(
        safeLayoutEntries.map(([breakpoint, breakpointLayout]) => {
          const presentWidgetIds = new Set(breakpointLayout.map((item) => item.i));

          if (presentWidgetIds.has(widgetId)) {
            return [breakpoint, breakpointLayout];
          }

          return [breakpoint, [...breakpointLayout, createWidgetLayoutItem(widgetId, breakpointLayout, placement)]];
        }),
      ) as GridLayouts;

      setLayouts(nextLayouts);
      persistPresetLayouts(currentPreset, nextLayouts);
      setHasLayoutChanges(true);
      toast.success(`${WIDGETS[widgetId].title} added`, {
        description: 'Layout updated and stored on this workstation.',
      });
    },
    [currentPreset, layouts],
  );

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

  const handleBrowserFullscreenToggle = useCallback(async () => {
    if (!document.fullscreenEnabled) {
      toast.error('Fullscreen is not available in this browser.');
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      toast.error('Unable to toggle browser fullscreen.');
    }
  }, []);

  const visibleWidgetIds = Array.from(
    new Set(
      Object.values(layouts).flatMap((breakpointLayouts) => breakpointLayouts.map((item) => item.i)),
    ),
  ).filter((widgetId): widgetId is WidgetId => widgetId in WIDGETS);
  const hiddenWidgetCount = allWidgetIds.length - visibleWidgetIds.length;
  const pendingBroadcasts = messages.filter((message) => message.status === 'sending').length;
  const widgetRuntimeProps = useMemo<WidgetRuntimeProps>(
    () => ({
      auditLogs,
      messages,
      onSendMessage: handleSendMessage,
      pendingCount: pendingBroadcasts,
    }),
    [auditLogs, handleSendMessage, messages, pendingBroadcasts],
  );

  if (maximizedWidget) {
    const widget = WIDGETS[maximizedWidget];
    const Widget = widget.component;

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
          <Widget {...widgetRuntimeProps} />
        </DashboardWidget>
        <Toaster position="top-right" richColors closeButton theme="dark" />
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[#0B1220] text-slate-200">
      <div className="shrink-0 border-b-2 border-cyan-900/50 bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 p-2 shadow-lg shadow-cyan-900/20">
        <div className="flex items-center justify-between gap-4 px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded bg-gradient-to-br from-cyan-500 to-blue-600 p-2 shadow-lg shadow-cyan-500/50">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-mono tracking-widest text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                EMERGENCY COMMAND CENTER
              </h1>
              <p className="truncate text-[10px] font-mono tracking-wider text-slate-500">
                MODULAR DASHBOARD SYSTEM | DRAGGABLE AND RESIZABLE WIDGETS
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
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
              variant="outline"
              size="sm"
              className={`${TOOLBAR_BUTTON_CLASS} ${layoutMode ? 'border-cyan-400/70 bg-cyan-950/60 text-cyan-50' : ''}`}
              onClick={() => setLayoutMode((current) => !current)}
            >
              <LayoutIcon className="h-4 w-4" />
              <span className="text-xs">{layoutMode ? 'Lock Layout' : 'Edit Layout'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className={`${TOOLBAR_BUTTON_CLASS} ${isWidgetLibraryOpen ? 'border-cyan-400/70 bg-cyan-950/60 text-cyan-50' : ''}`}
              onClick={() => setIsWidgetLibraryOpen((current) => !current)}
              aria-label="Open widget library"
            >
              <Library className="h-4 w-4" />
              <span className="text-xs">Widget Library</span>
              {hiddenWidgetCount > 0 && (
                <span className="ml-1 rounded bg-cyan-500/20 px-1.5 py-0.5 text-[10px] text-cyan-200">
                  {hiddenWidgetCount}
                </span>
              )}
            </Button>

            {(layoutMode || hasLayoutChanges) && (
              <>
                <Button variant="outline" size="sm" className={TOOLBAR_BUTTON_CLASS} onClick={handleSaveLayout}>
                  <Save className="h-4 w-4" />
                  <span className="text-xs">Save</span>
                </Button>
                <Button variant="outline" size="sm" className={TOOLBAR_BUTTON_CLASS} onClick={handleResetLayout}>
                  <RotateCcw className="h-4 w-4" />
                  <span className="text-xs">Reset</span>
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              className={TOOLBAR_BUTTON_CLASS}
              onClick={handleBrowserFullscreenToggle}
              aria-label={isBrowserFullscreen ? 'Exit browser fullscreen' : 'Enter browser fullscreen'}
            >
              {isBrowserFullscreen ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              <span className="text-xs">{isBrowserFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
            </Button>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <ClockChip />
          </div>
        </div>
      </div>

      <main
        className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-3 transition-[padding] duration-200 ${
          layoutMode ? 'pb-24' : ''
        } ${isWidgetLibraryOpen ? 'lg:pr-[410px]' : ''}`}
      >
        <DashboardGrid
          activeDragWidgetId={activeDragWidgetId}
          layoutMode={layoutMode}
          layouts={layouts}
          visibleWidgetIds={visibleWidgetIds}
          widgetRuntimeProps={widgetRuntimeProps}
          onCloseWidget={handleCloseWidget}
          onDropWidget={handleAddWidget}
          onLayoutChange={handleLayoutChange}
          onMaximizeWidget={setMaximizedWidget}
        />
      </main>

      <WidgetLibrary
        open={isWidgetLibraryOpen}
        visibleWidgetIds={visibleWidgetIds}
        onAddWidget={handleAddWidget}
        onClose={() => setIsWidgetLibraryOpen(false)}
        onWidgetDragEnd={() => setActiveDragWidgetId(null)}
        onWidgetDragStart={setActiveDragWidgetId}
      />

      {(layoutMode || hasLayoutChanges) && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border-2 border-cyan-500/50 bg-cyan-900/90 px-6 py-3 font-mono text-sm text-cyan-100 shadow-[0_0_30px_rgba(6,182,212,0.5)] backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <LayoutIcon className="h-5 w-5 animate-pulse" />
            <span>
              {layoutMode
                ? 'LAYOUT EDIT MODE ACTIVE | Drag widgets to reposition or resize from the lower-right corner'
                : 'UNSAVED LAYOUT CHANGES | Layout is stored locally; save to clear this notice'}
            </span>
          </div>
        </div>
      )}

      <Toaster position="top-right" richColors closeButton theme="dark" />
    </div>
  );
}
