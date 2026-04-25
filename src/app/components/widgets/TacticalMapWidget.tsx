import { Suspense, lazy } from 'react';

const ImprovedMapPanel = lazy(() =>
  import('../ImprovedMapPanel').then((module) => ({ default: module.ImprovedMapPanel })),
);

function MapLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-[#0f0f10]">
      <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2.5 font-mono text-[11px] tracking-[0.16em] text-zinc-300">
        LOADING TACTICAL MAP...
      </div>
    </div>
  );
}

export function TacticalMapWidget() {
  return (
    <Suspense fallback={<MapLoadingState />}>
      <ImprovedMapPanel />
    </Suspense>
  );
}
