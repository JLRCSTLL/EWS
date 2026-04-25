import { Suspense, lazy } from 'react';

const ImprovedMapPanel = lazy(() =>
  import('../ImprovedMapPanel').then((module) => ({ default: module.ImprovedMapPanel })),
);

function MapLoadingState() {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950">
      <div className="rounded border border-cyan-900/30 bg-slate-900/60 px-4 py-3 font-mono text-xs tracking-wider text-cyan-400">
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
