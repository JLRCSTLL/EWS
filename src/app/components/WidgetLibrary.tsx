import type { DragEvent } from 'react';
import { Check, GripVertical, Library, Plus, X } from 'lucide-react';
import { allWidgetIds, WIDGETS, type WidgetId } from '../lib/widget-registry';
import { Button } from './ui/button';

interface WidgetLibraryProps {
  open: boolean;
  visibleWidgetIds: WidgetId[];
  onAddWidget: (widgetId: WidgetId) => void;
  onClose: () => void;
  onWidgetDragEnd: () => void;
  onWidgetDragStart: (widgetId: WidgetId) => void;
}

function setDragPreview(event: DragEvent<HTMLElement>, title: string) {
  const preview = document.createElement('div');
  preview.textContent = title;
  preview.style.position = 'fixed';
  preview.style.top = '-1000px';
  preview.style.left = '-1000px';
  preview.style.zIndex = '9999';
  preview.style.padding = '10px 14px';
  preview.style.border = '1px solid rgba(34, 211, 238, 0.65)';
  preview.style.borderRadius = '12px';
  preview.style.background = 'rgba(15, 23, 42, 0.96)';
  preview.style.boxShadow = '0 0 26px rgba(34, 211, 238, 0.38)';
  preview.style.color = '#a5f3fc';
  preview.style.font = '12px monospace';
  preview.style.letterSpacing = '0';
  preview.style.pointerEvents = 'none';
  document.body.appendChild(preview);
  event.dataTransfer.setDragImage(preview, 24, 18);
  window.setTimeout(() => preview.remove(), 0);
}

export function WidgetLibrary({
  open,
  visibleWidgetIds,
  onAddWidget,
  onClose,
  onWidgetDragEnd,
  onWidgetDragStart,
}: WidgetLibraryProps) {
  if (!open) {
    return null;
  }

  const visibleWidgets = new Set(visibleWidgetIds);
  const hiddenWidgetCount = allWidgetIds.length - visibleWidgetIds.length;

  const handleDragStart = (event: DragEvent<HTMLElement>, widgetId: WidgetId) => {
    if (visibleWidgets.has(widgetId)) {
      event.preventDefault();
      return;
    }

    const widget = WIDGETS[widgetId];
    event.dataTransfer.effectAllowed = 'copy';
    event.dataTransfer.setData('application/x-ecc-widget', widgetId);
    event.dataTransfer.setData('text/plain', widgetId);
    setDragPreview(event, widget.libraryTitle);
    onWidgetDragStart(widgetId);
  };

  return (
    <aside className="fixed bottom-0 right-0 top-[60px] z-[70] flex w-[390px] max-w-[calc(100vw-1rem)] flex-col border-l border-t border-cyan-500/30 bg-[#0B1220] shadow-[-16px_0_50px_rgba(8,145,178,0.2)]">
      <div className="shrink-0 border-b border-cyan-900/40 bg-slate-950/70 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-sm tracking-wider text-cyan-300">
              <Library className="h-4 w-4" />
              <span>WIDGET LIBRARY</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Drag a widget into the grid or add it to the next open slot.
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            onClick={onClose}
            aria-label="Close widget library"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 rounded border border-cyan-900/40 bg-cyan-950/20 px-3 py-2 text-xs text-cyan-100">
          {hiddenWidgetCount} hidden widget{hiddenWidgetCount === 1 ? '' : 's'} available
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {allWidgetIds.map((widgetId) => {
          const widget = WIDGETS[widgetId];
          const isVisible = visibleWidgets.has(widgetId);

          return (
            <div
              key={widgetId}
              draggable={!isVisible}
              onDragStart={(event) => handleDragStart(event, widgetId)}
              onDragEnd={onWidgetDragEnd}
              className={`group rounded-xl border p-3 transition-all ${
                isVisible
                  ? 'border-slate-800 bg-slate-950/50 opacity-70'
                  : 'cursor-grab border-cyan-900/35 bg-slate-950/80 shadow-lg shadow-cyan-950/10 hover:border-cyan-500/60 hover:shadow-cyan-950/30 active:cursor-grabbing'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-800 bg-slate-900">
                  {widget.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-mono text-xs tracking-wider ${widget.headerColor}`}>
                    {widget.libraryTitle.toUpperCase()}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{widget.description}</p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
                    <GripVertical className="h-3.5 w-3.5 text-cyan-400/70" />
                    <span>Drag handle</span>
                    <span className="rounded border border-slate-800 px-1.5 py-0.5 font-mono">
                      {widget.defaultSize.w}x{widget.defaultSize.h}
                    </span>
                  </div>
                </div>
                <Button
                  variant={isVisible ? 'ghost' : 'outline'}
                  size="sm"
                  className={`h-8 min-w-[76px] gap-1 px-2 text-xs ${
                    isVisible
                      ? 'text-slate-500 hover:bg-transparent hover:text-slate-500'
                      : 'border-cyan-900/40 bg-slate-900 text-cyan-200 hover:bg-cyan-950/50'
                  }`}
                  disabled={isVisible}
                  onClick={() => onAddWidget(widgetId)}
                >
                  {isVisible ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {isVisible ? 'Added' : 'Add'}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
