import { createPlaceLookup, placeQuery } from './place-lookup.mjs';

export const sessionCookie = value => {
  const token = typeof value === 'string' && /(?:^|;\s*)eligtas_session=([A-Za-z0-9_-]{43})(?:;|$)/.exec(value)?.[1];
  return token ? `eligtas_session=${token}` : null;
};
const fail = (status, message) => { throw Object.assign(new Error(message), { status, publicMessage: message }); };
const accessError = status => {
  if (status === 401) fail(401, 'Your session expired. Please sign in again.');
  if (status === 403) fail(403, 'Approved command-center access is required.');
  if (status === 429) fail(429, 'Place search is busy. Please try again in a moment.');
  fail(503, 'Place search is temporarily unavailable. Try again or pin the location on the map.');
};

// The existing Vercel host performs geocoding; Render remains the authority for
// operator access. Never forward account cookies to the external map provider.
export function createPlaceSearchGateway({ fetcher = fetch, search = createPlaceLookup() } = {}) {
  return async (value, cookieHeader) => {
    const query = placeQuery(value), cookie = sessionCookie(cookieHeader);
    if (!cookie) fail(401, 'Sign in to continue.');
    let authorization;
    try {
      authorization = await fetcher('https://e-ligtas.onrender.com/api/response-places/authorize', {
        headers: { Cookie: cookie, Accept: 'application/json' },
        redirect: 'error', signal: AbortSignal.timeout(8000), cache: 'no-store',
      });
    } catch { fail(503, 'Operator access could not be checked. Please try again.'); }
    if (!authorization.ok) accessError(authorization.status);
    let data;
    try { data = await authorization.json(); } catch { fail(503, 'Operator access could not be checked. Please try again.'); }
    if (data?.ok !== true) fail(503, 'Operator access could not be checked. Please try again.');
    return search(query);
  };
}

// Render-hosted clients use the same gateway, with the same session validation.
// The URL is fixed to our existing frontend host; redirects are never followed.
export function createHostedPlaceLookup({ fetcher = fetch } = {}) {
  return async (value, cookieHeader) => {
    const query = placeQuery(value), cookie = sessionCookie(cookieHeader);
    if (!cookie) fail(401, 'Sign in to continue.');
    const url = new URL('https://ews-kappa.vercel.app/api/response-places');
    url.searchParams.set('q', query);
    try {
      const response = await fetcher(url, { headers: { Cookie: cookie, Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(20000), cache: 'no-store' });
      if (!response.ok) accessError(response.status);
      const data = await response.json();
      if (!Array.isArray(data?.places) || data.places.length > 10 || data.places.some(p => !p || typeof p.name !== 'string' || !Number.isFinite(p.lat) || !Number.isFinite(p.lng) || Math.abs(p.lat) > 85 || Math.abs(p.lng) > 180))
        fail(503, 'Place search returned an unreadable response. Try again.');
      return data.places;
    } catch (error) {
      if (error.status) throw error;
      fail(503, 'Place search could not connect. Try again or pin the location on the map.');
    }
  };
}
