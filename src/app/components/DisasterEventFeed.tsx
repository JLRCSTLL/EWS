import { AlertTriangle, MapPin, Radio, Satellite, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { disasterEvents, type DisasterEvent } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { ScrollArea } from './ui/scroll-area';

function getSeverityMeta(severity: DisasterEvent['severity']) {
  switch (severity) {
    case 'critical':
      return { label: 'CRITICAL', dotClass: 'bg-[#ff4d4d]', textClass: 'text-[#ff8080]' };
    case 'high':
      return { label: 'HIGH', dotClass: 'bg-[#ff9f43]', textClass: 'text-[#ffc285]' };
    case 'medium':
      return { label: 'MEDIUM', dotClass: 'bg-[#a8a8a8]', textClass: 'text-zinc-300' };
    case 'low':
      return { label: 'LOW', dotClass: 'bg-[#6b7280]', textClass: 'text-zinc-400' };
    default:
      return { label: 'INFO', dotClass: 'bg-zinc-500', textClass: 'text-zinc-300' };
  }
}

function getSourceIcon(source: DisasterEvent['source']) {
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
}

export function DisasterEventFeed() {
  const highImpactCount = disasterEvents.filter((event) => event.severity === 'critical' || event.severity === 'high').length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#111111]">
      <div className="shrink-0 border-b border-white/8 px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-zinc-200" />
            <h2 className="truncate font-mono text-xs tracking-[0.18em] text-zinc-100">INCIDENT/DISASTER FEED</h2>
          </div>
          <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-400">
            {highImpactCount} HIGH IMPACT
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-4">
          {disasterEvents.map((event, index) => {
            const severity = getSeverityMeta(event.severity);

            return (
              <motion.article
                key={event.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
                className="border-b border-white/6 py-3 last:border-b-0"
              >
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-mono tracking-[0.12em] text-zinc-400">
                  <span className={`h-2 w-2 rounded-full ${severity.dotClass}`} />
                  <span className={severity.textClass}>● {severity.label}</span>
                  <span className="text-zinc-500">|</span>
                  <span>{event.type.toUpperCase()}</span>
                </div>

                <h3 className="text-sm font-medium text-zinc-100">{event.title}</h3>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{event.description}</p>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    <span>{event.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {getSourceIcon(event.source)}
                    <span>{event.source.toUpperCase()}</span>
                  </div>
                  <div className="font-mono tracking-[0.12em]">{formatRelativeTime(event.createdAt).toUpperCase()}</div>
                </div>
              </motion.article>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
