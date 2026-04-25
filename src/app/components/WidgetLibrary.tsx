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
  preview.style.border = '1px solid rgba(255, 255, 255, 0.45)';
  preview.style.borderRadius = '999px';
  preview.style.background = 'rgba(12, 12, 14, 0.95)';
  preview.style.boxShadow = '0 12px 30px rgba(0, 0, 0, 0.5)';
  preview.style.color = '#f4f4f5';
  preview.style.font = '11px "IBM Plex Mono", monospace';
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
    <aside className="fixed bottom-0 right-0 top-[60px] z-[70] flex w-[360px] max-w-[calc(100vw-0.75rem)] flex-col border-l border-white/10 bg-[#0f0f10]/96 backdrop-blur-lg">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-sm tracking-[0.16em] text-zinc-100">
              <Library className="h-4 w-4" />
              <span>WIDGET LIBRARY</span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Drag into the grid, or tap add.</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-full border border-transparent text-zinc-400 hover:border-white/15 hover:bg-white/5 hover:text-zinc-100"
            onClick={onClose}
            aria-label="Close widget library"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-3 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">
          {hiddenWidgetCount} hidden widget{hiddenWidgetCount === 1 ? '' : 's'} available
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {allWidgetIds.map((widgetId) => {
          const widget = WIDGETS[widgetId];
          const isVisible = visibleWidgets.has(widgetId);

          return (
            <div
              key={widgetId}
              draggable={!isVisible}
              onDragStart={(event) => handleDragStart(event, widgetId)}
              onDragEnd={onWidgetDragEnd}
              className={`group border-b border-white/5 px-4 py-3 transition-colors ${
                isVisible
                  ? 'opacity-45'
                  : 'cursor-grab hover:bg-white/[0.04] active:cursor-grabbing'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.02]">
                  {widget.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`truncate font-mono text-[11px] tracking-[0.14em] ${widget.headerColor}`}>
                    {widget.libraryTitle.toUpperCase()}
                  </div>
                  <p className="mt-0.5 truncate text-[11px] text-zinc-500">{widget.description}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px] text-zinc-500">
                    <GripVertical className="h-3.5 w-3.5 text-zinc-400" />
                    <span className="font-mono tracking-[0.08em]">
                      {widget.defaultSize.w}x{widget.defaultSize.h}
                    </span>
                  </div>
                </div>
                <Button
                  variant={isVisible ? 'ghost' : 'outline'}
                  size="sm"
                  className={`h-7 min-w-[64px] gap-1 rounded-full px-2 text-[10px] tracking-[0.1em] ${
                    isVisible
                      ? 'text-zinc-500 hover:bg-transparent hover:text-zinc-500'
                      : 'border-white/15 bg-white/[0.02] text-zinc-100 hover:bg-white/[0.07]'
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
