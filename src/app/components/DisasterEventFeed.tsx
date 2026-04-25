import { AlertTriangle, MapPin, Radio, Satellite, Users } from 'lucide-react';
import { disasterEvents, type DisasterEvent } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

const getSeverityColor = (severity: DisasterEvent['severity']) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-400 border-red-500';
    case 'high':
      return 'bg-orange-500/20 text-orange-400 border-orange-500';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500';
    case 'low':
      return 'bg-blue-500/20 text-blue-400 border-blue-500';
    default:
      return 'bg-slate-500/20 text-slate-400 border-slate-500';
  }
};

const getSourceIcon = (source: DisasterEvent['source']) => {
  switch (source) {
    case 'satellite':
      return <Satellite className="h-3 w-3" />;
    case 'sensor':
      return <Radio className="h-3 w-3" />;
    case 'report':
      return <Users className="h-3 w-3" />;
    default:
      return <AlertTriangle className="h-3 w-3" />;
  }
};

export function DisasterEventFeed() {
  const criticalCount = disasterEvents.filter((event) => event.severity === 'critical' || event.severity === 'high').length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="shrink-0 border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
            <h2 className="truncate font-mono tracking-wider text-red-400">DISASTER EVENT FEED</h2>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <Badge variant="outline" className="border-red-900/50 text-xs text-red-400">
              {criticalCount} HIGH IMPACT
            </Badge>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
              <span className="font-mono text-xs text-red-400/70">LIVE</span>
            </div>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {disasterEvents.map((event) => (
            <div
              key={event.id}
              className={`rounded-r border-l-4 bg-slate-900/50 p-3 transition-colors hover:bg-slate-900/80 ${
                getSeverityColor(event.severity).split(' ')[2]
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge className={getSeverityColor(event.severity)}>{event.severity.toUpperCase()}</Badge>
                    <Badge variant="outline" className="border-cyan-900/50 text-xs text-cyan-400">
                      {event.type.toUpperCase()}
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-slate-200">{event.title}</h3>
                </div>
              </div>

              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-400">{event.description}</p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getSourceIcon(event.source)}
                    <span>{event.source}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 font-mono text-xs text-cyan-400/70">{formatRelativeTime(event.createdAt)}</div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
