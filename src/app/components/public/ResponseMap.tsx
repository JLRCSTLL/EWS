import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { ResponsePoint, ResponseRoute } from "../../lib/response";
export function ResponseMap({
  position,
  destination,
  route,
  satellite = true,
  follow = true,
  select,
  onSelect,
}: {
  position?: { lat: number; lng: number } | null;
  destination?: ResponsePoint | null;
  route?: ResponseRoute | null;
  satellite?: boolean;
  follow?: boolean;
  select?: ResponsePoint | null;
  onSelect?: (p: ResponsePoint) => void;
}) {
  const element = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    marker = useRef<L.Marker | null>(null),
    pick = useRef(onSelect),
    manual = useRef(false);
  pick.current = onSelect;
  useEffect(() => {
    if (!element.current) return;
    const current = L.map(element.current, {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([14.58, 121.1], 12);
    map.current = current;
    current.on("click", (e) =>
      pick.current?.({ ...e.latlng, label: "Pinned emergency location" }),
    );
    current.on("dragstart", () => {
      manual.current = true;
    });
    const observer = new ResizeObserver(() => current.invalidateSize());
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
        icon: L.divIcon({
          className: "rsp-destination",
          html: "<span></span>",
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        }),
      })
        .addTo(group)
        .bindTooltip(label, { direction: "top" });
      if (route?.coordinates.length)
        current.fitBounds(
          L.latLngBounds(route.coordinates.map(([lng, lat]) => [lat, lng])),
          {
            paddingTopLeft: [35, 160],
            paddingBottomRight: [35, 270],
            maxZoom: 16,
            animate: false,
          },
        );
      else if (select)
        current.setView(
          [select.lat, select.lng],
          Math.max(current.getZoom(), 14),
          { animate: false },
        );
      else current.setView([target.lat, target.lng], 15, { animate: false });
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
    if (!marker.current)
      marker.current = L.marker([position.lat, position.lng], {
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
    if (follow && !manual.current && !pick.current)
      current.panTo([position.lat, position.lng], {
        animate: true,
        duration: 0.7,
      });
  }, [position?.lat, position?.lng, follow]);
  useEffect(() => {
    if (follow && position && map.current) {
      manual.current = false;
      map.current.panTo([position.lat, position.lng]);
    }
  }, [follow]);
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
