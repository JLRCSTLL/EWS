import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ResponsePoint, ResponseRoute } from "../../lib/response";
import { mapViewport, type MapInsets } from "../../lib/map-viewport";
const defaultInsets: MapInsets = { top: 35, right: 35, bottom: 35, left: 35 };
export function ResponseMap({
  position,
  destination,
  route,
  satellite = true,
  follow = true,
  select,
  onSelect,
  interactive = true,
  onFollowChange,
  recenterKey = 0,
  insets = defaultInsets,
}: {
  position?: { lat: number; lng: number } | null;
  destination?: ResponsePoint | null;
  route?: ResponseRoute | null;
  satellite?: boolean;
  follow?: boolean;
  select?: ResponsePoint | null;
  onSelect?: (p: ResponsePoint) => void;
  interactive?: boolean;
  onFollowChange?: (follow: boolean) => void;
  recenterKey?: number;
  insets?: MapInsets;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.Marker | null>(null),
    pick = useRef(onSelect),
    manual = useRef(false);
  const followChange = useRef(onFollowChange);
  const frameView = useRef<() => void>(() => {});
  const padding = useRef(insets);
  padding.current = insets;
  function panToVisibleCenter(current: L.Map, point: { lat: number; lng: number }, animate = false, zoom = current.getZoom()) {
    const size = current.getSize();
    const { centerOffset } = mapViewport(size.x, size.y, padding.current);
    const center = current.unproject(current.project([point.lat, point.lng], zoom).add(centerOffset), zoom);
    current.setView(center, zoom, { animate, duration: .5 });
  }
  function fitRoute(current: L.Map) {
    if (!route?.coordinates.length) return;
    const size = current.getSize();
    const { paddingTopLeft, paddingBottomRight } = mapViewport(size.x, size.y, padding.current);
    current.fitBounds(L.latLngBounds(route.coordinates.map(([lng, lat]) => [lat, lng])), {
      paddingTopLeft, paddingBottomRight, maxZoom: 16, animate: false,
    });
  }
  frameView.current = () => {
    const current = map.current;
    if (!current || manual.current) return;
    if (follow && position && !pick.current) panToVisibleCenter(current, position);
    else if (route?.coordinates.length) fitRoute(current);
    else if (select || destination) panToVisibleCenter(current, (select || destination)!);
  };
  pick.current = onSelect;
  followChange.current = onFollowChange;
  useEffect(() => {
    if (!element.current) return;
    const current = L.map(element.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: interactive,
      dragging: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
    }).setView([14.58, 121.1], 12);
    map.current = current;
    current.on("click", (e) =>
      pick.current?.({ ...e.latlng, label: "Pinned emergency location" }),
    );
    current.on("dragstart", () => {
      manual.current = true;
      followChange.current?.(false);
    });
    const observer = new ResizeObserver(() => {
      current.invalidateSize({ pan: false });
      frameView.current();
    });
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      current.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const tiles = L.tileLayer(
      satellite
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution: satellite
          ? "Imagery © Esri"
          : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    ).addTo(current);
    return () => {
      tiles.remove();
    };
  }, [satellite]);
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    const group = L.layerGroup().addTo(current);
    if (route?.coordinates.length) {
      const line = route.coordinates.map(
        ([lng, lat]) => [lat, lng] as L.LatLngTuple,
      );
      L.polyline(line, { color: "#102525", weight: 11, opacity: 0.9 }).addTo(
        group,
      );
      L.polyline(line, { color: "#85eed2", weight: 6, opacity: 1 }).addTo(
        group,
      );
    }
    const target = select || destination;
    if (target) {
      const label = document.createElement("span");
      label.textContent = target.label;
      L.marker([target.lat, target.lng], {
        keyboard: interactive,
        interactive,
        title: target.label,
        alt: target.label,
        icon: L.divIcon({
          className: "rsp-destination",
          html: "<span></span>",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .addTo(group)
        .bindTooltip(label, { direction: "top" });
      if (route?.coordinates.length) fitRoute(current);
      else if (select)
        panToVisibleCenter(current, select, false, Math.max(current.getZoom(), 14));
      else panToVisibleCenter(current, target, false, 15);
    }
    manual.current = false;
    return () => {
      group.remove();
    };
  }, [
    destination?.lat,
    destination?.lng,
    select?.lat,
    select?.lng,
    route?.generatedAt,
  ]);
  useEffect(() => {
    const current = map.current;
    if (!current) return;
    if (!position) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    const firstFix = !marker.current;
    if (!marker.current)
      marker.current = L.marker([position.lat, position.lng], {
        keyboard: interactive,
        interactive,
        title: "Your shared position",
        alt: "Your shared position",
        zIndexOffset: 1200,
        icon: L.divIcon({
          className: "rsp-vehicle",
          html: '<span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h11v12H3zM14 10h4l3 4v4h-7M6 9h5M8.5 6.5v5M17 11.5V14h3"/><circle cx="6.5" cy="18" r="2" fill="#f3fff9"/><circle cx="17.5" cy="18" r="2" fill="#f3fff9"/></svg></span>',
          iconSize: [48, 48],
          iconAnchor: [24, 24],
        }),
      })
        .addTo(current)
        .bindTooltip("Your shared position");
    else marker.current.setLatLng([position.lat, position.lng]);
    if ((follow || (!destination && !route && firstFix)) && !manual.current && !pick.current)
      panToVisibleCenter(current, position, true);
  }, [position?.lat, position?.lng, follow]);
  useEffect(() => {
    if (follow && position && map.current) {
      manual.current = false;
      panToVisibleCenter(map.current, position, true);
    }
  }, [follow, recenterKey]);
  useEffect(() => { frameView.current(); }, [insets.top, insets.right, insets.bottom, insets.left]);
  return (
    <div
      className="rsp-map"
      ref={element}
      role="region"
      aria-label={
        onSelect ? "Choose a location on the map" : "Responder navigation map"
      }
    />
  );
}
