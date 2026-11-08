import { useLayoutEffect, useState, type RefObject } from 'react';
import { responderMapInsets, type MapInsets } from '../../lib/map-viewport';

export function useResponderMapInsets(workspace: RefObject<HTMLDivElement>, layout: string) {
  const [insets, setInsets] = useState<MapInsets>({ top: 32, right: 32, bottom: 32, left: 32 });
  useLayoutEffect(() => {
    const root = workspace.current;
    if (!root) return;
    const overlays = [...root.querySelectorAll<HTMLElement>('[data-map-occlusion]')];
    const measure = () => {
      const next = responderMapInsets(root.getBoundingClientRect(), overlays.map(el => ({
        edge: el.dataset.mapOcclusion as 'top' | 'sheet' | 'bottom', rect: el.getBoundingClientRect(),
      })));
      setInsets(previous => Object.keys(next).every(key => previous[key as keyof MapInsets] === next[key as keyof MapInsets]) ? previous : next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    overlays.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [workspace, layout]);
  return insets;
}
