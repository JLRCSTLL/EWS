import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from './ui/button';

interface DashboardWidgetProps {
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  onMaximize?: () => void;
  onMinimize?: () => void;
  onClose?: () => void;
  isMaximized?: boolean;
  className?: string;
  headerColor?: string;
}

export function DashboardWidget({
  title,
  icon,
  children,
  onMaximize,
  onMinimize,
  onClose,
  isMaximized = false,
  className = '',
  headerColor = 'text-cyan-400',
}: DashboardWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950 shadow-lg ${className}`}>
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GripVertical className="drag-handle h-4 w-4 cursor-grab text-slate-600 active:cursor-grabbing" />
            {icon}
            <h2 className={`${headerColor} text-sm font-mono tracking-wider`}>{title}</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-slate-800"
              onClick={() => setIsCollapsed((current) => !current)}
              aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3 w-3 text-slate-400" />
              ) : (
                <ChevronUp className="h-3 w-3 text-slate-400" />
              )}
            </Button>
            {!isMaximized && onMaximize && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-slate-800"
                onClick={onMaximize}
                aria-label={`Maximize ${title}`}
              >
                <Maximize2 className="h-3 w-3 text-slate-400" />
              </Button>
            )}
            {isMaximized && onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-slate-800"
                onClick={onMinimize}
                aria-label={`Minimize ${title}`}
              >
                <Minimize2 className="h-3 w-3 text-slate-400" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 hover:bg-red-900/50"
                onClick={onClose}
                aria-label={`Close ${title}`}
              >
                <X className="h-3 w-3 text-slate-400" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {!isCollapsed && <div className="flex-1 overflow-hidden">{children}</div>}
    </div>
  );
}
