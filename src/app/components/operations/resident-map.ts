import L from 'leaflet';
import { geofenceDistance, type GeofenceGeometry } from '../../lib/geofencing';
import { liveLocationLabel, locationAgeMinutes, locationStatus, matchesGroup, residentGroups, type Resident } from '../../lib/residents';

export function fenceLayer(geometry: GeofenceGeometry, style: L.PathOptions = {}) {
  if (geometry.shape === 'boundary') return L.polygon(geometry.polygons!.map(rings => rings.map(ring => ring.map(point => L.latLng(point.lat,point.lng)))), style);
  const points = geometry.points.map(point => L.latLng(point.lat, point.lng));
  if (geometry.shape === 'circle') return L.circle(points[0], { ...style, radius: geofenceDistance(geometry.points[0], geometry.points[1]) });
  if (geometry.shape === 'rectangle') return L.rectangle(L.latLngBounds(points), style);
  return L.polygon(points, style);
}

export function residentMarker(user: Resident, at: string, options: { muted?: boolean; interactive?: boolean; live?: boolean } = {}) {
  if (!user.location) return null;
  const status = options.live ? (locationAgeMinutes(user,at) <= .5 ? 'active' : locationAgeMinutes(user,at) <= 5 ? 'recent' : 'stale') : locationStatus(user, at);
  const marker = L.circleMarker([user.location.lat, user.location.lng], {
    radius: options.muted ? 3 : options.live ? 8 : 5,
    color: options.muted ? '#b0b0b0' : options.live ? '#fff' : status === 'active' ? '#aff0ce' : status === 'recent' ? '#f0d29b' : '#9b9b9b',
    fillColor: status === 'active' ? '#8ddab4' : status === 'recent' ? '#d9b477' : '#999',
    weight: options.muted ? 1 : options.live ? 3 : 1.5, opacity: options.muted ? .35 : 1,
    fillOpacity: options.muted ? .15 : options.live ? 1 : status === 'stale' ? .25 : .85,
    interactive: options.interactive !== false,
    bubblingMouseEvents: false,
  });
  const popup = document.createElement('div');
  popup.className = 'ops-resident-popup';
  const title = document.createElement('strong');
  title.textContent = `${user.name}${options.live ? '' : ' · demo'}`;
  const groups = residentGroups.filter(group => matchesGroup(user, group.id)).map(group => group.label);
  const details = document.createElement('p');
  details.textContent = options.live ? 'On-duty personnel · preferred name' : `Age ${user.age}${groups.length ? ` · ${groups.join(', ')}` : ''}`;
  const location = document.createElement('p');
  location.textContent = `${options.live ? liveLocationLabel(user.location.updatedAt,at) : `${status} · ${Math.round(locationAgeMinutes(user,at))} min before snapshot`} · ±${Math.round(user.location.accuracy)} m`;
  const coordinates = document.createElement('p');
  coordinates.textContent = `${user.location.lat.toFixed(5)}, ${user.location.lng.toFixed(5)}`;
  const delivery = document.createElement('small');
  delivery.textContent = user.notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled · excluded from alerts';
  popup.append(title, details, location, coordinates, delivery);
  if (options.live) {
    const label = document.createElement('span');
    label.textContent = user.name;
    marker.bindTooltip(label, { direction: 'top', offset: [0, -9], className: 'ops-map-tooltip' });
  }
  return marker.bindPopup(popup, { className: 'ops-user-popup', maxWidth: 260 });
}
