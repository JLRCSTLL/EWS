import { createPlaceSearchGateway } from '../server/place-search-gateway.mjs';

const search = createPlaceSearchGateway();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Use GET for place search.' });
  }
  try {
    const params = new URL(req.url, 'https://ews-kappa.vercel.app').searchParams;
    const query = params.getAll('q');
    if (query.length !== 1) return res.status(400).json({ error: 'Enter one place name to search.' });
    return res.status(200).json({ places: await search(query[0], req.headers.cookie) });
  } catch (error) {
    return res.status(error.status || 503).json({ error: error.publicMessage || 'Place search is temporarily unavailable. Try again or pin the location on the map.' });
  }
}
