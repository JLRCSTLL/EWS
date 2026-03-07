import { Activity, Cpu, HardDrive, Server, Wifi } from 'lucide-react';
import { cpuData, networkData, servers, systemMetrics } from '../lib/dashboard-data';
import { Progress } from './ui/progress';

function AreaChart({ data, color = '#06b6d4' }: { data: { time: string; value: number }[]; color?: string }) {
  const maxValue = Math.max(...data.map((point) => point.value));
  const width = 100;
  const height = 100;

  const points = data.map((point, index) => ({
    x: (index / (data.length - 1)) * width,
    y: height - (point.value / maxValue) * height,
  }));

  const pathData = points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }
    return `${path} L ${point.x} ${point.y}`;
  }, '');

  const areaPath = `${pathData} L ${width} ${height} L 0 ${height} Z`;

  return (
    <div className="relative h-[120px] w-full rounded border border-slate-800 bg-slate-900/50 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((gridLine) => (
          <line
            key={`grid-y-${gridLine}`}
            x1="0"
            y1={gridLine}
            x2={width}
            y2={gridLine}
            stroke="#1e293b"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        ))}
        <path d={areaPath} fill={color} fillOpacity="0.2" />
        <path d={pathData} fill="none" stroke={color} strokeWidth="2" />
        {points.map((point, index) => (
          <circle key={`point-${index}`} cx={point.x} cy={point.y} r="2" fill={color} />
        ))}
      </svg>
    </div>
  );
}

function LineChart({
  data,
  lines,
}: {
  data: { time: string; inbound: number; outbound: number }[];
  lines: { key: 'inbound' | 'outbound'; color: string }[];
}) {
  const maxValue = Math.max(...data.flatMap((point) => [point.inbound, point.outbound]));
  const width = 100;
  const height = 100;

  return (
    <div className="relative h-[120px] w-full rounded border border-slate-800 bg-slate-900/50 p-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
        {[0, 25, 50, 75, 100].map((gridLine) => (
          <line
            key={`grid-line-${gridLine}`}
            x1="0"
            y1={gridLine}
            x2={width}
            y2={gridLine}
            stroke="#1e293b"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
        ))}

        {lines.map((line) => {
          const points = data.map((point, index) => ({
            x: (index / (data.length - 1)) * width,
            y: height - (point[line.key] / maxValue) * height,
          }));

          const pathData = points.reduce((path, point, index) => {
            if (index === 0) {
              return `M ${point.x} ${point.y}`;
            }
            return `${path} L ${point.x} ${point.y}`;
          }, '');

          return (
            <g key={line.key}>
              <path d={pathData} fill="none" stroke={line.color} strokeWidth="2" />
              {points.map((point, index) => (
                <circle key={`${line.key}-point-${index}`} cx={point.x} cy={point.y} r="2" fill={line.color} />
              ))}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const metricIcons = {
  cpu: Cpu,
  server: Server,
  storage: HardDrive,
  network: Wifi,
};

export function SystemHealth() {
  const onlineServers = servers.filter((server) => server.status === 'online').length;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-cyan-900/30 bg-slate-950">
      <div className="border-b border-cyan-900/30 bg-gradient-to-r from-slate-900 to-slate-950 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-green-400" />
            <h2 className="font-mono tracking-wider text-green-400">SYSTEM HEALTH</h2>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="font-mono text-xs text-green-400/70">{onlineServers}/{servers.length} SYSTEMS ONLINE</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="space-y-4 p-3">
          <div className="grid grid-cols-4 gap-3">
            {systemMetrics.map((metric) => {
              const MetricIcon = metricIcons[metric.icon];

              return (
                <div key={metric.id} className="space-y-2 rounded border border-slate-800 bg-slate-900/50 p-3">
                  <div className="flex items-center gap-2">
                    <MetricIcon className={`h-4 w-4 ${metric.color}`} />
                    <span className="text-xs text-slate-400">{metric.label}</span>
                  </div>
                  <div className="font-mono text-2xl text-slate-200">{metric.value}%</div>
                  <div className="relative">
                    <Progress value={metric.value} className="h-2 bg-slate-800" />
                    <div className={`absolute left-0 top-0 h-2 rounded-full ${metric.barColor}`} style={{ width: `${metric.value}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 text-sm text-cyan-400">
              <Cpu className="h-4 w-4" />
              <span>CPU UTILIZATION</span>
            </div>
            <AreaChart data={cpuData} color="#06b6d4" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 px-3 text-sm text-orange-400">
              <Wifi className="h-4 w-4" />
              <span>NETWORK ACTIVITY (MB/s)</span>
              <div className="ml-auto flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-3 bg-green-500" />
                  <span className="text-slate-400">Inbound</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="h-0.5 w-3 bg-orange-500" />
                  <span className="text-slate-400">Outbound</span>
                </div>
              </div>
            </div>
            <LineChart data={networkData} lines={[{ key: 'inbound', color: '#10b981' }, { key: 'outbound', color: '#f97316' }]} />
          </div>

          <div className="space-y-2 rounded border border-slate-800 bg-slate-900/50 p-3">
            <div className="mb-2 flex items-center gap-2 text-sm text-green-400">
              <Server className="h-4 w-4" />
              <span>SERVER STATUS</span>
            </div>
            <div className="space-y-2">
              {servers.map((server) => (
                <div key={server.id} className="flex items-center justify-between rounded bg-slate-800/50 p-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${server.status === 'online' ? 'bg-green-400' : 'bg-blue-400'}`} />
                    <span className="text-slate-300">{server.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-slate-500">
                      Uptime: <span className="text-green-400">{server.uptime}</span>
                    </div>
                    <div className="text-slate-500">
                      Load: <span className="text-cyan-400">{server.load}%</span>
                    </div>
                    <div className={`rounded px-2 py-1 ${server.status === 'online' ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'}`}>
                      {server.status.toUpperCase()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
