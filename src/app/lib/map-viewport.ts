export interface MapInsets { top: number; right: number; bottom: number; left: number }
export interface MapRect { left: number; top: number; right: number; bottom: number; width: number; height: number }
export interface MapOverlay { edge: 'top' | 'sheet' | 'bottom'; rect: MapRect }

/** Measure the usable map, including a sheet that docks on the right in landscape. */
export function responderMapInsets(viewport: MapRect, overlays: MapOverlay[]): MapInsets {
  const inset = { top: 32, right: 32, bottom: 32, left: 32 };
  for (const { edge, rect } of overlays) {
    if (!rect.width || !rect.height || rect.bottom <= viewport.top || rect.top >= viewport.bottom) continue;
    if (edge === 'top') inset.top = Math.max(inset.top, rect.bottom - viewport.top + 28);
    else if (edge === 'bottom') inset.bottom = Math.max(inset.bottom, viewport.bottom - rect.top + 24);
    else if (rect.left - viewport.left >= viewport.width * .4 && rect.width <= viewport.width * .6)
      inset.right = Math.max(inset.right, viewport.right - rect.left + 32);
    else if (rect.right - viewport.left <= viewport.width * .6 && rect.width <= viewport.width * .6)
      inset.left = Math.max(inset.left, rect.right - viewport.left + 32);
    else inset.bottom = Math.max(inset.bottom, viewport.bottom - rect.top + 32);
  }
  return inset;
}

/** Leave a finite camera area even while chat or the keyboard covers most of the map. */
export function mapViewport(width: number, height: number, insets: MapInsets) {
  function pair(start: number, end: number, size: number) {
    const a = Math.max(0, start), b = Math.max(0, end), available = Math.max(0, size - 64);
    const factor = a + b > available ? available / (a + b || 1) : 1;
    return [a * factor, b * factor];
  }
  const [left, right] = pair(insets.left, insets.right, width);
  const [top, bottom] = pair(insets.top, insets.bottom, height);
  return {
    paddingTopLeft: [left, top] as [number, number],
    paddingBottomRight: [right, bottom] as [number, number],
    // Add to the projected location to put it at the visible map's center.
    centerOffset: [(right - left) / 2, (bottom - top) / 2] as [number, number],
  };
}
