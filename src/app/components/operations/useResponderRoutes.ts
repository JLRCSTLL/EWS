import { useEffect, useRef, type RefObject } from 'react';
import L from 'leaflet';
import { responderTeams } from '../../lib/dashboard-data';
import { getRouteProgress, RESPONDER_DEMO_DURATION, responderRoutes, type ResponderRoute } from '../../lib/responder-routes';

interface Options {
  mapRef: RefObject<L.Map | null>;
  visible: boolean;
  drawing: boolean;
  paused: boolean;
  replay: number;
  selectedId: string | null;
  onSelect: (teamId: string) => void;
  onTick: (elapsed: number) => void;
}

// A north-facing vehicle silhouette rotates with its bearing; the unit label stays upright.
function vehicleIcon(vehicle: ResponderRoute['vehicle']) {
  const body = vehicle === 'fire' ? '#ce7058' : vehicle === 'ambulance' ? '#f5f6f3' : '#c1ced8';
  const equipment = vehicle === 'ambulance'
    ? '<rect x="10" y="24" width="12" height="12" rx="2" fill="#e3eaf0"/><path d="M14 26h4v3h3v4h-3v3h-4v-3h-3v-4h3z" fill="#326485"/><path d="M8 22h16" stroke="#7196ac" stroke-width="2"/>'
    : vehicle === 'fire'
      ? '<rect x="10" y="22" width="12" height="19" rx="1.5" fill="#6e3c32"/><path d="M12 23v17m8-17v17m-8-14h8m-8 4h8m-8 4h8m-8 4h8" stroke="#dbe2e6" stroke-width="1.5"/>'
      : '<rect x="9" y="23" width="14" height="15" rx="2" fill="#536b7a"/><path d="M11 26h10m-10 4h10m-10 4h10" stroke="#9db2c0" stroke-width="1.3"/><path d="M10 22v17m12-17v17" stroke="#dee6eb" stroke-width="1.5"/>';
  return `<svg class="ops-vehicle-glyph" viewBox="0 0 32 48" fill="none" stroke-linejoin="round" aria-hidden="true">
    <path d="M5 11h3v9H5zm19 0h3v9h-3zM5 32h3v9H5zm19 0h3v9h-3z" fill="#111820" stroke="#a6b2bb" stroke-width=".7"/>
    <rect x="7" y="3" width="18" height="42" rx="5" fill="${body}" stroke="#fff" stroke-opacity=".75" stroke-width="1"/>
    <path d="M9 11q7-3 14 0l-1 6H10z" fill="#203b4b" stroke="#88a8ba" stroke-width=".8"/>
    <path d="m10 11 11 1" stroke="#c7dde6" stroke-opacity=".65"/>
    <path d="M8 19h16" stroke="#344651" stroke-width="4"/>
    <path d="M9 19h6" stroke="#ed6b72" stroke-width="2.5"/><path d="M17 19h6" stroke="#74b7ff" stroke-width="2.5"/>
    ${equipment}
    <path d="M10 5h3m6 0h3" stroke="#fff6ca" stroke-width="2" stroke-linecap="round"/>
    <path d="M9 42h3m8 0h3" stroke="#ab4249" stroke-width="1.5"/>
    <path d="M13 43h6" stroke="#59707e" stroke-width="1"/>
  </svg>`;
}
const flagIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 21V3m0 1c5-4 9 4 14 0v10c-5 4-9-4-14 0"/></svg>';
const attribution = 'Demo routes: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

export function useResponderRoutes(options: Options) {
  const current = useRef(options);
  const elapsed = useRef(0);
  current.current = options;

  useEffect(() => { elapsed.current = 0; current.current.onTick(0); }, [options.replay]);

  useEffect(() => {
    const map = options.mapRef.current;
    if (!map || !options.visible) return;
    const group = L.layerGroup().addTo(map);
    map.attributionControl?.addAttribution(attribution);
    const units = responderRoutes.map(route => {
      const team = responderTeams.find(item => item.id === route.teamId)!;
      const initial = getRouteProgress(route, elapsed.current);
      const casing = L.polyline(route.points, { color: '#111a22', opacity: .95, weight: 8, interactive: false }).addTo(group);
      const traveled = L.polyline(route.points, { color: '#798590', opacity: .65, weight: 3, interactive: false }).addTo(group);
      const remaining = L.polyline(initial.remainingPoints, { color: route.color, opacity: .95, weight: 4, interactive: false, className: 'ops-driving-route' }).addTo(group);
      const destination = L.marker(route.points[route.points.length - 1], {
        title: `${route.label} destination: ${route.destination}`, alt: `${route.label} destination: ${route.destination}`,
        icon: L.divIcon({ className: 'ops-route-destination', html: `<span style="--route-color:${route.color}">${flagIcon}</span>`, iconSize: [30, 30], iconAnchor: [15, 26] }),
        interactive: !options.drawing, keyboard: !options.drawing, zIndexOffset: 800,
      }).addTo(group).on('click', () => current.current.onSelect(route.teamId));
      const destinationText = document.createElement('span');
      destinationText.textContent = route.destination;
      destination.bindTooltip(destinationText, { permanent: false, direction: 'top', offset: [0, -25], className: 'ops-map-tooltip ops-route-target-label' });
      const marker = L.marker(initial.position, {
        title: `${route.label} · ${team.name}`, alt: `${route.label} · ${team.name}`,
        icon: L.divIcon({ className: 'ops-route-vehicle', html: `<span class="ops-vehicle-body" style="--route-color:${route.color}"><i class="ops-vehicle-heading"></i>${vehicleIcon(route.vehicle)}</span><span class="ops-vehicle-label"><i style="background:${route.color}"></i>${route.label}</span>`, iconSize: [44, 44], iconAnchor: [22, 22] }),
        interactive: !options.drawing, keyboard: !options.drawing, zIndexOffset: 1300, riseOnHover: true,
      }).addTo(group).on('click', () => current.current.onSelect(route.teamId));
      const label = document.createElement('span');
      label.textContent = `${team.name} → ${route.destination} · simulated`;
      marker.bindTooltip(label, { direction: 'top', offset: [0, -23], className: 'ops-map-tooltip' });
      const element = marker.getElement();
      element?.setAttribute('aria-label', `${route.label} · ${team.name}`);
      destination.getElement()?.setAttribute('aria-label', `${route.label} destination: ${route.destination}`);
      return { route, marker, destination, casing, traveled, remaining, element,
        heading: element?.querySelector<HTMLElement>('.ops-vehicle-heading'),
        vehicle: element?.querySelector<SVGElement>('.ops-vehicle-glyph'),
      };
    });
    let frame = 0;
    let previous = performance.now();
    let painted = 0;
    let lastTick = -Infinity;
    let lastElapsed = -1;
    let lastSelection: string | null | undefined;
    const paint = (now: number) => {
      const state = current.current;
      const seconds = Math.max(0, Math.min((now - previous) / 1000, .1));
      previous = now;
      if (!state.paused && !state.drawing && !document.hidden) elapsed.current = Math.min(RESPONDER_DEMO_DURATION, elapsed.current + seconds);
      const selectedChanged = state.selectedId !== lastSelection;
      if ((now - painted >= 40 && lastElapsed !== elapsed.current) || selectedChanged) {
        painted = now;
        lastElapsed = elapsed.current;
        units.forEach(unit => {
          const position = getRouteProgress(unit.route, elapsed.current);
          unit.marker.setLatLng(position.position);
          unit.remaining.setLatLngs(position.remainingPoints);
          if (unit.heading) unit.heading.style.transform = `rotate(${position.heading}deg)`;
          if (unit.vehicle) unit.vehicle.style.transform = `rotate(${position.heading}deg)`;
          unit.element?.classList.toggle('is-arrived', position.arrived);
          if (selectedChanged) {
            const selected = unit.route.teamId === state.selectedId;
            const muted = !!state.selectedId && !selected;
            unit.remaining.setStyle({ weight: selected ? 5 : 3.5, opacity: muted ? .35 : 1 });
            unit.casing.setStyle({ weight: selected ? 9 : 7, opacity: muted ? .35 : .95 });
            unit.traveled.setStyle({ opacity: muted ? .2 : .6 });
            unit.marker.setOpacity(muted ? .65 : 1);
            unit.marker.setZIndexOffset(selected ? 1600 : 1300);
            unit.element?.classList.toggle('is-selected', selected);
            if (selected) { unit.remaining.bringToFront(); unit.destination.openTooltip(); }
            else unit.destination.closeTooltip();
          }
        });
        lastSelection = state.selectedId;
      }
      if (now - lastTick > 750) { state.onTick(elapsed.current); lastTick = now; }
      frame = requestAnimationFrame(paint);
    };
    frame = requestAnimationFrame(paint);
    return () => {
      cancelAnimationFrame(frame);
      group.remove();
      map.attributionControl?.removeAttribution(attribution);
    };
  }, [options.mapRef, options.visible, options.drawing, options.replay]);
}
