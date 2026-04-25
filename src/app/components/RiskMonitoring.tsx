import { AlertCircle, Shield, TrendingUp } from 'lucide-react';
import { riskAreas, type RiskArea } from '../lib/dashboard-data';
import { formatFullNumber } from '../lib/formatting';
import { Progress } from './ui/progress';
import { ScrollArea } from './ui/scroll-area';

const getStatusColor = (status: RiskArea['status']) => {
  switch (status) {
    case 'critical':
      return 'text-red-400 bg-red-500/20';
    case 'high':
      return 'text-orange-400 bg-orange-500/20';
    case 'medium':
      return 'text-yellow-400 bg-yellow-500/20';
    case 'low':
      return 'text-green-400 bg-green-500/20';
    default:
      return 'text-slate-400 bg-slate-500/20';
  }
};

const getRiskColor = (level: number) => {
  if (level >= 80) {
    return 'bg-red-500';
  }
  if (level >= 60) {
    return 'bg-orange-500';
  }
  if (level >= 40) {
    return 'bg-yellow-500';
  }
  return 'bg-green-500';
};

export function RiskMonitoring() {
  const highestRisk = Math.max(...riskAreas.map((area) => area.riskLevel));

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/8 bg-[#111111]">
      <div className="shrink-0 border-b border-white/10 bg-white/[0.01] p-3">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Shield className="h-5 w-5 shrink-0 text-orange-400" />
            <h2 className="truncate font-mono tracking-wider text-orange-400">RISK AND VULNERABILITY</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <span className="font-mono text-xs text-orange-400/70">PEAK {highestRisk}%</span>
          </div>
        </div>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-3 p-3">
          {riskAreas.map((area) => (
            <div
              key={area.id}
              className="space-y-3 rounded-xl border border-white/10 bg-[#141416] p-3 transition-colors hover:border-white/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h3 className="mb-1 text-sm font-medium text-slate-200">{area.name}</h3>
                  <div className="text-xs text-slate-500">Population: {formatFullNumber(area.population)}</div>
                </div>
                <div className={`shrink-0 rounded px-2 py-1 text-xs font-mono ${getStatusColor(area.status)}`}>{area.status.toUpperCase()}</div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Risk Level</span>
                  <span className="font-mono text-slate-200">{area.riskLevel}%</span>
                </div>
                <div className="relative">
                  <Progress value={area.riskLevel} className="h-2 bg-slate-800" />
                  <div className={`absolute left-0 top-0 h-2 rounded-full ${getRiskColor(area.riskLevel)}`} style={{ width: `${area.riskLevel}%` }} />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs text-slate-400">
                  <AlertCircle className="h-3 w-3" />
                  <span>Vulnerabilities</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {area.vulnerabilities.map((vulnerability) => (
                    <div key={vulnerability} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-400">
                      {vulnerability}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
