import { Responsive, WidthProvider, type Layout } from 'react-grid-layout/legacy';
import { DashboardWidget } from './DashboardWidget';
import { WIDGETS, type WidgetId, type WidgetRuntimeProps } from '../lib/widget-registry';

const ResponsiveGridLayout = WidthProvider(Responsive);
const WIDGET_DRAG_MIME = 'application/x-ecc-widget';

type GridLayouts = Record<string, Layout[]>;

interface DashboardGridProps {
  activeDragWidgetId: WidgetId | null;
  layoutMode: boolean;
  layouts: GridLayouts;
  visibleWidgetIds: WidgetId[];
  widgetRuntimeProps: WidgetRuntimeProps;
  onCloseWidget: (widgetId: WidgetId) => void;
  onDropWidget: (widgetId: WidgetId, placement?: Partial<Layout>) => void;
  onLayoutChange: (layout: Layout[], allLayouts: GridLayouts) => void;
  onMaximizeWidget: (widgetId: WidgetId) => void;
}

function getWidgetIdFromDrop(event: Event, fallback: WidgetId | null): WidgetId | null {
  const dataTransfer = (event as DragEvent).dataTransfer;
  const droppedValue = dataTransfer?.getData(WIDGET_DRAG_MIME) || dataTransfer?.getData('text/plain');

  if (droppedValue && droppedValue in WIDGETS) {
    return droppedValue as WidgetId;
  }

  return fallback;
}

export function DashboardGrid({
  activeDragWidgetId,
  layoutMode,
  layouts,
  visibleWidgetIds,
  widgetRuntimeProps,
  onCloseWidget,
  onDropWidget,
  onLayoutChange,
  onMaximizeWidget,
}: DashboardGridProps) {
  const visibleWidgetSet = new Set<WidgetId>(visibleWidgetIds);
  const activeWidget = activeDragWidgetId ? WIDGETS[activeDragWidgetId] : null;
  const canDropActiveWidget = Boolean(activeDragWidgetId && !visibleWidgetSet.has(activeDragWidgetId));

  return (
    <div className={`relative min-h-full min-w-0 ${canDropActiveWidget ? 'dashboard-drop-active' : ''}`}>
      {canDropActiveWidget && (
        <div className="pointer-events-none absolute inset-0 z-10 rounded-2xl border border-dashed border-white/30 bg-white/[0.02]">
          <div className="absolute right-4 top-4 rounded-full border border-white/20 bg-black/70 px-3 py-2 font-mono text-[11px] tracking-[0.14em] text-zinc-100">
            DROP TO SNAP INTO GRID
          </div>
        </div>
      )}

      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
        rowHeight={80}
        isDraggable={layoutMode}
        isResizable={layoutMode}
        isDroppable
        droppingItem={{
          i: activeDragWidgetId ? `__dropping-${activeDragWidgetId}` : '__dropping-widget',
          w: activeWidget?.defaultSize.w ?? 4,
          h: activeWidget?.defaultSize.h ?? 3,
        }}
        resizeHandles={['se']}
        onLayoutChange={onLayoutChange}
        onDrop={(layout, item, event) => {
          const widgetId = getWidgetIdFromDrop(event, activeDragWidgetId);
          if (!widgetId) {
            return;
          }

          onDropWidget(widgetId, item ?? undefined);
        }}
        onDropDragOver={() => {
          if (!activeDragWidgetId || visibleWidgetSet.has(activeDragWidgetId)) {
            return false;
          }

          return WIDGETS[activeDragWidgetId].defaultSize;
        }}
        draggableHandle=".drag-handle"
        compactType="vertical"
        margin={[14, 14]}
      >
        {visibleWidgetIds.map((widgetId) => {
          const widget = WIDGETS[widgetId];
          const Widget = widget.component;

          return (
            <div key={widgetId} className="dashboard-item">
              <DashboardWidget
                title={widget.title}
                icon={widget.icon}
                headerColor={widget.headerColor}
                onMaximize={() => onMaximizeWidget(widgetId)}
                onClose={() => onCloseWidget(widgetId)}
              >
                <Widget {...widgetRuntimeProps} />
              </DashboardWidget>
            </div>
          );
        })}
      </ResponsiveGridLayout>
    </div>
  );
}
