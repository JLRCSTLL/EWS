import { Activity, Cpu, HardDrive, Server, Wifi } from 'lucide-react';
import { motion } from 'motion/react';
import { cpuData, networkData, servers, systemMetrics } from '../lib/dashboard-data';

const metricIcons = {
  cpu: Cpu,
  server: Server,
  storage: HardDrive,
  network: Wifi,
};

function DotMeter({ value }: { value: number }) {
  const totalDots = 10;
  const filledDots = Math.max(0, Math.min(totalDots, Math.round((value / 100) * totalDots)));

  return (
    <div className="font-mono text-[11px] tracking-[0.14em] text-zinc-300">
      {'['}
      {'•'.repeat(filledDots)}
      {'○'.repeat(totalDots - filledDots)}
      {']'}
    </div>
  );
}

function DotLineGraph({
  data,
  keyName,
  stroke,
}: {
  data: { time: string; value: number }[];
  keyName: 'value';
  stroke: string;
}) {
  const width = 140;
  const height = 44;
  const maxValue = Math.max(...data.map((point) => point[keyName]), 1);

  const points = data.map((point, index) => ({
    x: (index / (data.length - 1 || 1)) * width,
    y: height - (point[keyName] / maxValue) * (height - 4) - 2,
  }));

  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" preserveAspectRatio="none">
      {Array.from({ length: 5 }).map((_, index) => (
        <line
          key={`grid-${index}`}
          x1="0"
          y1={index * 11}
          x2={width}
          y2={index * 11}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
          strokeDasharray="1.5 3.5"
        />
      ))}
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
      {points.map((point, index) => (
        <circle key={`point-${index}`} cx={point.x} cy={point.y} r="1.6" fill={stroke} />
      ))}
    </svg>
  );
}

function DualLineGraph({
  data,
}: {
  data: { time: string; inbound: number; outbound: number }[];
}) {
  const width = 140;
  const height = 44;
  const maxValue = Math.max(...data.flatMap((point) => [point.inbound, point.outbound]), 1);

  const buildPath = (key: 'inbound' | 'outbound') =>
    data
      .map((point, index) => {
        const x = (index / (data.length - 1 || 1)) * width;
        const y = height - (point[key] / maxValue) * (height - 4) - 2;
        return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
      })
      .join(' ');

  const inboundPath = buildPath('inbound');
  const outboundPath = buildPath('outbound');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-11 w-full" preserveAspectRatio="none">
      {Array.from({ length: 5 }).map((_, index) => (
        <line
          key={`grid-network-${index}`}
          x1="0"
          y1={index * 11}
          x2={width}
          y2={index * 11}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="0.8"
          strokeDasharray="1.5 3.5"
        />
      ))}
      <path d={inboundPath} fill="none" stroke="#44d17f" strokeWidth="1.35" strokeLinecap="round" />
      <path d={outboundPath} fill="none" stroke="#ff9f43" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export function SystemHealth() {
  const onlineServers = servers.filter((server) => server.status === 'online').length;

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#111111]">
      <div className="shrink-0 border-b border-white/8 px-4 py-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Activity className="h-4 w-4 shrink-0 text-zinc-100" />
            <h2 className="truncate font-mono text-xs tracking-[0.18em] text-zinc-100">SYSTEM HEALTH</h2>
          </div>
          <div className="font-mono text-[10px] tracking-[0.14em] text-zinc-400">
            {onlineServers}/{servers.length} ONLINE
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {systemMetrics.map((metric, index) => {
            const MetricIcon = metricIcons[metric.icon];

            return (
              <motion.div
                key={metric.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03, ease: 'easeOut' }}
                className="rounded-xl border border-white/8 bg-[#141416] px-3 py-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-zinc-300">
                    <MetricIcon className="h-3.5 w-3.5" />
                    <span className="text-[11px] uppercase tracking-[0.12em]">{metric.label}</span>
                  </div>
                  <span className="font-mono text-sm text-zinc-100">{metric.value}%</span>
                </div>
                <DotMeter value={metric.value} />
              </motion.div>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-white/8 bg-[#141416] px-3 py-2.5">
            <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-zinc-400">CPU TREND</div>
            <DotLineGraph data={cpuData} keyName="value" stroke="#f5f5f5" />
          </div>
          <div className="rounded-xl border border-white/8 bg-[#141416] px-3 py-2.5">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] tracking-[0.14em] text-zinc-400">NETWORK TREND</span>
              <span className="text-[10px] text-zinc-500">
                <span className="mr-2 text-[#44d17f]">IN</span>
                <span className="text-[#ff9f43]">OUT</span>
              </span>
            </div>
            <DualLineGraph data={networkData} />
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-white/8 bg-[#141416] px-3 py-2.5">
          <div className="mb-2 font-mono text-[10px] tracking-[0.14em] text-zinc-400">NODE STATUS</div>
          <div className="space-y-2">
            {servers.map((server) => (
              <div key={server.id} className="flex items-center justify-between gap-2 text-xs">
                <div className="flex min-w-0 items-center gap-2 text-zinc-300">
                  <span className={`h-2 w-2 rounded-full ${server.status === 'online' ? 'bg-[#2bd576]' : 'bg-[#ff9f43]'}`} />
                  <span className="truncate">{server.name}</span>
                </div>
                <div className="font-mono text-[11px] text-zinc-500">
                  {server.uptime} | {server.load}%
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
