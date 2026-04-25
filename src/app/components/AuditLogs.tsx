import { Activity, FileText, Settings, Shield, Users } from 'lucide-react';
import type { AuditLogEntry } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface AuditLogsProps {
  logs: AuditLogEntry[];
}

const getTypeIcon = (type: AuditLogEntry['type']) => {
  switch (type) {
    case 'config':
      return <Settings className="h-4 w-4" />;
    case 'user':
      return <Users className="h-4 w-4" />;
    case 'access':
      return <Shield className="h-4 w-4" />;
    case 'system':
      return <Activity className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

const getSeverityColor = (severity: AuditLogEntry['severity']) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500';
    case 'warning':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    case 'info':
      return 'bg-white/10 text-zinc-300 border-white/20';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500';
  }
};

const getTypeColor = (type: AuditLogEntry['type']) => {
  switch (type) {
    case 'config':
      return 'text-zinc-300';
    case 'user':
      return 'text-zinc-300';
    case 'access':
      return 'text-orange-400';
    case 'system':
      return 'text-green-400';
    default:
      return 'text-slate-400';
  }
};

export function AuditLogs({ logs }: AuditLogsProps) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111111]">
      <div className="shrink-0 border-b border-white/10 bg-white/[0.01] p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-zinc-200" />
            <h2 className="truncate font-mono tracking-wider text-zinc-100">AUDIT LOGS</h2>
          </div>
          <Badge variant="outline" className="border-white/20 text-xs text-zinc-300">
            {logs.length} EVENTS
          </Badge>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-2 p-3">
          {logs.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
              No audit events are available.
            </div>
          )}

          {logs.map((log) => (
            <div
              key={log.id}
              className="space-y-2 rounded-xl border border-white/10 bg-[#141416] p-3 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className={getTypeColor(log.type)}>{getTypeIcon(log.type)}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm text-slate-200">{log.action}</h3>
                  </div>
                </div>
                <Badge className={getSeverityColor(log.severity)}>{log.severity.toUpperCase()}</Badge>
              </div>

              <p className="text-xs text-slate-400">{log.details}</p>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-2 text-xs">
                <div className="text-slate-500">
                  <span className="text-slate-400">User:</span> {log.user}
                </div>
                <div className="font-mono text-zinc-400">{formatRelativeTime(log.createdAt)}</div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
