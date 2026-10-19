import L from 'leaflet';
import { geofenceDistance, type GeofenceGeometry } from '../../lib/geofencing';
import { locationAgeMinutes, locationStatus, matchesGroup, residentGroups, type Resident } from '../../lib/residents';

export function fenceLayer(geometry: GeofenceGeometry, style: L.PathOptions = {}) {
  const points = geometry.points.map(point => L.latLng(point.lat, point.lng));
  if (geometry.shape === 'circle') return L.circle(points[0], { ...style, radius: geofenceDistance(geometry.points[0], geometry.points[1]) });
  if (geometry.shape === 'rectangle') return L.rectangle(L.latLngBounds(points), style);
  return L.polygon(points, style);
}

export function residentMarker(user: Resident, at: string, options: { muted?: boolean; interactive?: boolean; live?: boolean } = {}) {
  if (!user.location) return null;
  const status = locationStatus(user, at);
  const marker = L.circleMarker([user.location.lat, user.location.lng], {
    radius: options.muted ? 3 : 5,
    color: options.muted ? '#b0b0b0' : status === 'active' ? '#aff0ce' : status === 'recent' ? '#f0d29b' : '#9b9b9b',
    fillColor: status === 'active' ? '#8ddab4' : status === 'recent' ? '#d9b477' : '#999',
    weight: options.muted ? 1 : 1.5, opacity: options.muted ? .35 : 1,
    fillOpacity: options.muted ? .15 : status === 'stale' ? .25 : .85,
    interactive: options.interactive !== false,
  });
  const popup = document.createElement('div');
  popup.className = 'ops-resident-popup';
  const title = document.createElement('strong');
  title.textContent = `${user.name}${options.live ? '' : ' · demo'}`;
  const groups = residentGroups.filter(group => matchesGroup(user, group.id)).map(group => group.label);
  const details = document.createElement('p');
  details.textContent = options.live ? `Self-reported groups: ${groups.join(', ') || 'None specified'}` : `Age ${user.age}${groups.length ? ` · ${groups.join(', ')}` : ''}`;
  const location = document.createElement('p');
  location.textContent = `${status} · ${Math.round(locationAgeMinutes(user, at))} min ${options.live ? 'ago' : 'before snapshot'} · ±${Math.round(user.location.accuracy)} m`;
  const coordinates = document.createElement('p');
  coordinates.textContent = `${user.location.lat.toFixed(5)}, ${user.location.lng.toFixed(5)}`;
  const delivery = document.createElement('small');
  delivery.textContent = user.notificationsEnabled ? 'Notifications enabled' : 'Notifications disabled · excluded from alerts';
  popup.append(title, details, location, coordinates, delivery);
  return marker.bindPopup(popup, { className: 'ops-user-popup', maxWidth: 260 });
}
