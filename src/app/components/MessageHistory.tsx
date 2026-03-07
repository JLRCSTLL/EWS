import { CheckCircle, Clock, MessageSquare, XCircle } from 'lucide-react';
import type { DashboardMessage } from '../lib/dashboard-data';
import { formatFullNumber, formatRelativeTime } from '../lib/formatting';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

interface MessageHistoryProps {
  messages: DashboardMessage[];
}

const getPriorityColor = (priority: DashboardMessage['priority']) => {
  switch (priority) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500';
    case 'normal':
      return 'bg-blue-500/20 text-blue-400 border-blue-500';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500';
  }
};

const getStatusConfig = (status: DashboardMessage['status']) => {
  switch (status) {
    case 'delivered':
      return {
        icon: <CheckCircle className="h-3 w-3" />,
        color: 'text-green-400',
        label: 'DELIVERED',
      };
    case 'sending':
      return {
        icon: <Clock className="h-3 w-3 animate-pulse" />,
        color: 'text-yellow-400',
        label: 'QUEUED',
      };
    case 'failed':
      return {
        icon: <XCircle className="h-3 w-3" />,
        color: 'text-red-400',
        label: 'FAILED',
      };
    default:
      return {
        icon: <Clock className="h-3 w-3" />,
        color: 'text-slate-400',
        label: 'UNKNOWN',
      };
  }
};

export function MessageHistory({ messages }: MessageHistoryProps) {
  const queuedCount = messages.filter((message) => message.status === 'sending').length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <h2 className="font-mono tracking-wider text-purple-400">MESSAGE HISTORY</h2>
          </div>
          <div className="flex items-center gap-2">
            {queuedCount > 0 && (
              <Badge variant="outline" className="border-yellow-900/50 text-xs text-yellow-400">
                {queuedCount} QUEUED
              </Badge>
            )}
            <Badge variant="outline" className="border-purple-900/50 text-xs text-purple-400">
              {messages.length} TOTAL
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {messages.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/40 p-6 text-center text-sm text-slate-500">
              No outbound broadcasts have been recorded yet.
            </div>
          )}

          {messages.map((message) => {
            const statusConfig = getStatusConfig(message.status);

            return (
              <div
                key={message.id}
                className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-colors hover:border-cyan-900/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getPriorityColor(message.priority)}>{message.priority.toUpperCase()}</Badge>
                    <Badge variant="outline" className="border-cyan-900/50 text-xs text-cyan-400">
                      {message.category}
                    </Badge>
                  </div>
                  <div className={`flex items-center gap-1 text-xs ${statusConfig.color}`}>
                    {statusConfig.icon}
                    <span>{statusConfig.label}</span>
                  </div>
                </div>

                <p className="text-sm text-slate-300">{message.content}</p>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-xs">
                  <div>
                    <div className="text-slate-500">Sender</div>
                    <div className="text-slate-400">{message.sender}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Target</div>
                    <div className="text-slate-400">{message.targetGroup}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Recipients</div>
                    <div className="text-slate-400">{formatFullNumber(message.recipients)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Time</div>
                    <div className="font-mono text-cyan-400">{formatRelativeTime(message.createdAt)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
