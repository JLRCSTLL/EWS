import { ReactNode, useState } from 'react';
import { ChevronDown, ChevronUp, GripVertical, Maximize2, Minimize2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
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
  headerColor = 'text-zinc-100',
}: DashboardWidgetProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0.96, scale: 0.995 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ filter: 'brightness(1.06)' }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={`dashboard-widget flex h-full min-h-0 min-w-0 flex-col overflow-hidden ${className}`}
    >
      <div className="dashboard-widget-header shrink-0 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <GripVertical className="drag-handle h-4 w-4 shrink-0 cursor-grab text-zinc-500 active:cursor-grabbing" />
            {icon}
            <h2 className={`dashboard-widget-title ${headerColor} truncate text-xs font-mono sm:text-sm`}>{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="dashboard-control-btn h-6 w-6 p-0 text-zinc-300 hover:bg-zinc-800/70"
              onClick={() => setIsCollapsed((current) => !current)}
              aria-label={isCollapsed ? `Expand ${title}` : `Collapse ${title}`}
            >
              {isCollapsed ? (
                <ChevronDown className="h-3 w-3 text-zinc-300" />
              ) : (
                <ChevronUp className="h-3 w-3 text-zinc-300" />
              )}
            </Button>
            {!isMaximized && onMaximize && (
              <Button
                variant="ghost"
                size="sm"
                className="dashboard-control-btn h-6 w-6 p-0 text-zinc-300 hover:bg-zinc-800/70"
                onClick={onMaximize}
                aria-label={`Maximize ${title}`}
              >
                <Maximize2 className="h-3 w-3 text-zinc-300" />
              </Button>
            )}
            {isMaximized && onMinimize && (
              <Button
                variant="ghost"
                size="sm"
                className="dashboard-control-btn h-6 w-6 p-0 text-zinc-300 hover:bg-zinc-800/70"
                onClick={onMinimize}
                aria-label={`Minimize ${title}`}
              >
                <Minimize2 className="h-3 w-3 text-zinc-300" />
              </Button>
            )}
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                className="dashboard-control-btn dashboard-close-btn h-6 w-6 p-0 text-zinc-300"
                onClick={onClose}
                aria-label={`Close ${title}`}
              >
                <X className="h-3 w-3 text-zinc-300" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            key="widget-content"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className="min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
