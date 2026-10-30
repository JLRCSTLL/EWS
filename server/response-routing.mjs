import { distanceMeters } from "../src/app/lib/response.ts";
const fail = (message) => {
  throw Object.assign(new Error(message), {
    status: 503,
    publicMessage: message,
  });
};
async function json(response) {
  if (!response.ok)
    fail(
      "Map directions are temporarily unavailable. Retry or open your navigation app.",
    );
  let size = 0;
  const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 4 * 1024 * 1024) fail("Map response was too large.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    fail("Map directions could not be read.");
  }
}
export function createResponseRouting({
  fetcher = fetch,
  routeOrigin = process.env.ROUTING_ORIGIN || "https://router.project-osrm.org",
  hospitalOrigin = process.env.HOSPITAL_LOOKUP_URL ||
    "https://overpass-api.de/api/interpreter",
} = {}) {
  const cache = new Map();
  let routeQueue = Promise.resolve(),
    lastRoute = 0,
    pending = 0;
  function scheduled(task) {
    if (pending >= 4)
      fail("Road routing is busy. Retry shortly or open your navigation app.");
    pending++;
    const job = routeQueue
      .then(async () => {
        const wait = 1100 - (Date.now() - lastRoute);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        lastRoute = Date.now();
        return task();
      })
      .finally(() => pending--);
    routeQueue = job.catch(() => {});
    return job;
  }
  return {
    async route(origin, destination) {
      return scheduled(async () => {
        const coordinates = [origin, destination]
          .map((p) => p.lng.toFixed(6) + "," + p.lat.toFixed(6))
          .join(";");
        const url = new URL("/route/v1/driving/" + coordinates, routeOrigin);
        url.search = new URLSearchParams({
          overview: "full",
          geometries: "geojson",
          steps: "true",
          alternatives: "false",
        });
        let result;
        try {
          result = await json(
            await fetcher(url, {
              signal: AbortSignal.timeout(12000),
              redirect: "error",
              headers: { "User-Agent": "CommandCenter-Responder/1.2" },
            }),
          );
        } catch {
          fail(
            "Road routing is unavailable. Retry or open your navigation app.",
          );
        }
        const route = result.routes?.[0];
        if (
          result.code !== "Ok" ||
          !route?.geometry?.coordinates?.length ||
          !Number.isFinite(route.distance) ||
          !Number.isFinite(route.duration)
        )
          fail(
            "No drivable route was found. Verify the destination with dispatch.",
          );
        const points = route.geometry.coordinates;
        if (
          points.length > 50000 ||
          points.some(
            (p) =>
              !Array.isArray(p) ||
              !Number.isFinite(p[0]) ||
              !Number.isFinite(p[1]) ||
              Math.abs(p[0]) > 180 ||
              Math.abs(p[1]) > 85,
          )
        )
          fail("Invalid road geometry.");
        const steps = (route.legs || [])
          .flatMap((l) => l.steps || [])
          .slice(0, 1000)
          .map((s) => {
            const type = s.maneuver?.type || "continue",
              modifier = s.maneuver?.modifier || "",
              road = String(s.name || "").slice(0, 120);
            let instruction =
              type === "arrive"
                ? "Arrive at your destination"
                : type === "depart"
                  ? "Head " + (modifier || "toward the route")
                  : type.includes("roundabout")
                    ? "At the roundabout, take exit " +
                      (s.maneuver?.exit || "shown")
                    : type === "turn"
                      ? "Turn " + modifier
                      : type === "merge"
                        ? "Merge " + modifier
                        : "Continue " + modifier;
            if (road && type !== "arrive") instruction += " on " + road;
            const p = s.maneuver?.location || [
              destination.lng,
              destination.lat,
            ];
            return {
              instruction: instruction.trim(),
              distance: s.distance || 0,
              duration: s.duration || 0,
              point: { lat: p[1], lng: p[0], label: road },
              type,
              modifier,
            };
          });
        return {
          coordinates: points,
          distance: route.distance,
          duration: route.duration,
          steps,
          generatedAt: new Date().toISOString(),
        };
      });
    },
    async hospitals(point) {
      const lat = Number(point.lat.toFixed(2)),
        lng = Number(point.lng.toFixed(2)),
        key = lat + "," + lng;
      const old = cache.get(key);
      if (old && old.until > Date.now()) return old.items;
      const query =
        '[out:json][timeout:15];nwr["amenity"="hospital"](around:30000,' +
        lat +
        "," +
        lng +
        ");out center tags;";
      let result;
      try {
        result = await json(
          await fetcher(hospitalOrigin, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "CommandCenter-Responder/1.2",
            },
            body: new URLSearchParams({ data: query }),
            signal: AbortSignal.timeout(10000),
            redirect: "error",
          }),
        );
      } catch {
        fail(
          "Nearby hospital lookup is unavailable. Ask dispatch to select a hospital from its directory.",
        );
      }
      const items = (result.elements || [])
        .flatMap((e) => {
          const p = e.center || e,
            t = e.tags || {};
          if (
            !Number.isFinite(p.lat) ||
            !Number.isFinite(p.lon) ||
            !t.name ||
            Math.abs(p.lat) > 85 ||
            Math.abs(p.lon) > 180 ||
            t.disused === "yes" ||
            t.abandoned === "yes"
          )
            return [];
          return [
            {
              id: "osm:" + e.type + ":" + e.id,
              label: String(t.name).slice(0, 120),
              lat: p.lat,
              lng: p.lon,
              source: "OpenStreetMap",
              emergency:
                t.emergency === "yes"
                  ? "Emergency department mapped"
                  : "Emergency capability unverified",
            },
          ];
        })
        .filter((p) => distanceMeters(point, p) < 35000);
      if (cache.size > 100) cache.delete(cache.keys().next().value);
      cache.set(key, { until: Date.now() + 5 * 60 * 1000, items });
      return items;
    },
  };
}
