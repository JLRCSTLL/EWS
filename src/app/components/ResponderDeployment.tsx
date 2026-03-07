import { Activity, AlertCircle, CheckCircle, Clock, MapPin, Users } from 'lucide-react';
import { responderTeams, type ResponderTeam } from '../lib/dashboard-data';
import { formatRelativeTime } from '../lib/formatting';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';

const getStatusConfig = (status: ResponderTeam['status']) => {
  switch (status) {
    case 'deployed':
      return {
        color: 'bg-red-500/20 text-red-400 border-red-500',
        icon: <Activity className="h-3 w-3" />,
        label: 'DEPLOYED',
      };
    case 'active':
      return {
        color: 'bg-green-500/20 text-green-400 border-green-500',
        icon: <CheckCircle className="h-3 w-3" />,
        label: 'ACTIVE',
      };
    case 'standby':
      return {
        color: 'bg-blue-500/20 text-blue-400 border-blue-500',
        icon: <Clock className="h-3 w-3" />,
        label: 'STANDBY',
      };
    case 'returning':
      return {
        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500',
        icon: <AlertCircle className="h-3 w-3" />,
        label: 'RETURNING',
      };
    default:
      return {
        color: 'bg-slate-500/20 text-slate-400 border-slate-500',
        icon: <Activity className="h-3 w-3" />,
        label: 'UNKNOWN',
      };
  }
};

export function ResponderDeployment() {
  const totalPersonnel = responderTeams.reduce((sum, team) => sum + team.personnel, 0);
  const activeTeams = responderTeams.filter((team) => team.status === 'deployed' || team.status === 'active').length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-green-400" />
            <h2 className="font-mono tracking-wider text-green-400">RESPONDER DEPLOYMENT</h2>
          </div>
          <Badge variant="outline" className="border-green-900/50 text-xs text-green-400">
            {activeTeams} ACTIVE TEAMS
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-cyan-900/30 bg-slate-900/50 p-3">
        <div className="rounded bg-slate-800/50 p-2">
          <div className="mb-1 text-xs text-slate-400">Total Personnel</div>
          <div className="font-mono text-2xl text-green-400">{totalPersonnel}</div>
        </div>
        <div className="rounded bg-slate-800/50 p-2">
          <div className="mb-1 text-xs text-slate-400">Active Teams</div>
          <div className="font-mono text-2xl text-cyan-400">
            {activeTeams}/{responderTeams.length}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {responderTeams.map((team) => {
            const statusConfig = getStatusConfig(team.status);

            return (
              <div
                key={team.id}
                className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-3 transition-colors hover:border-cyan-900/50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="mb-1 text-sm font-medium text-slate-200">{team.name}</h3>
                    <div className="text-xs text-slate-500">{team.type}</div>
                  </div>
                  <Badge className={statusConfig.color}>
                    <div className="flex items-center gap-1">
                      {statusConfig.icon}
                      <span>{statusConfig.label}</span>
                    </div>
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-300">{team.personnel} personnel</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-slate-400">{team.location}</span>
                </div>

                <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                  {team.deployedAt ? (
                    <div className="font-mono text-xs text-orange-400">Deployed {formatRelativeTime(team.deployedAt)}</div>
                  ) : (
                    <div />
                  )}
                  <div className="font-mono text-xs text-cyan-400/70">Updated {formatRelativeTime(team.lastUpdateAt)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
