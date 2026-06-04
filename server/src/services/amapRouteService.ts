import { getMapsKey } from './mapsService';

export type RouteProfile = 'driving' | 'walking' | 'transit';

export interface RouteWaypoint {
  lat: number;
  lng: number;
}

export interface RouteResult {
  coordinates: [number, number][];
  distance: number;
  duration: number;
  distanceText: string;
  durationText: string;
  walkingText: string;
  drivingText: string;
}

export interface RouteSegment {
  mid: [number, number];
  from: [number, number];
  to: [number, number];
  walkingText: string;
  drivingText: string;
}

const AMAP_ROUTE_ENDPOINTS: Record<RouteProfile, string> = {
  driving: 'https://restapi.amap.com/v5/direction/driving',
  walking: 'https://restapi.amap.com/v5/direction/walking',
  transit: 'https://restapi.amap.com/v5/direction/transit/integrated',
};

const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594323;

function outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function transformLat(x: number, y: number): number {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x: number, y: number): number {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function wgs84ToGcj02(lat: number, lng: number): RouteWaypoint {
  if (outOfChina(lat, lng)) return { lat, lng };
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

function gcj02ToWgs84(lat: number, lng: number): RouteWaypoint {
  if (outOfChina(lat, lng)) return { lat, lng };
  const gcj = wgs84ToGcj02(lat, lng);
  return { lat: lat * 2 - gcj.lat, lng: lng * 2 - gcj.lng };
}

function formatPoint(point: RouteWaypoint): string {
  const gcj = wgs84ToGcj02(point.lat, point.lng);
  return `${gcj.lng},${gcj.lat}`;
}

function parsePolyline(polyline?: string): [number, number][] {
  if (!polyline) return [];
  return polyline
    .split(';')
    .map((pair) => {
      const [lngRaw, latRaw] = pair.split(',');
      const lat = Number(latRaw);
      const lng = Number(lngRaw);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const wgs = gcj02ToWgs84(lat, lng);
      return [wgs.lat, wgs.lng] as [number, number];
    })
    .filter((point): point is [number, number] => Boolean(point));
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.max(1, Math.round((seconds % 3600) / 60));
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

function validateWaypoints(waypoints: RouteWaypoint[]): void {
  if (!Array.isArray(waypoints) || waypoints.length < 2) {
    throw Object.assign(new Error('At least 2 waypoints required'), { status: 400 });
  }
  for (const point of waypoints) {
    if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) {
      throw Object.assign(new Error('Invalid waypoint coordinates'), { status: 400 });
    }
  }
}

function assertAmapOk(data: { status?: string; info?: string; infocode?: string; errdetail?: string }): void {
  if (data.status === '1') return;
  const message = data.info || data.errdetail || 'Amap route API error';
  throw Object.assign(new Error(message), { status: 502, infocode: data.infocode });
}

async function fetchAmapLeg(
  userId: number,
  origin: RouteWaypoint,
  destination: RouteWaypoint,
  profile: RouteProfile,
): Promise<RouteResult> {
  const apiKey = getMapsKey(userId);
  if (!apiKey) {
    throw Object.assign(new Error('Amap API key not configured'), { status: 400 });
  }

  const params = new URLSearchParams({
    key: apiKey,
    origin: formatPoint(origin),
    destination: formatPoint(destination),
    show_fields: 'polyline,cost',
  });

  const response = await fetch(`${AMAP_ROUTE_ENDPOINTS[profile]}?${params}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await response.json() as {
    status?: string;
    info?: string;
    infocode?: string;
    route?: {
      paths?: { distance?: string; cost?: { duration?: string }; steps?: { polyline?: string }[] }[];
      transits?: {
        distance?: string;
        cost?: { duration?: string };
        segments?: {
          walking?: { steps?: { polyline?: string }[] };
          bus?: { buslines?: { polyline?: string }[] };
        }[];
      }[];
    };
  };

  if (!response.ok) {
    throw Object.assign(new Error(`Amap route request failed: ${response.status}`), { status: 502 });
  }
  assertAmapOk(data);

  const path = data.route?.paths?.[0];
  const transit = data.route?.transits?.[0];
  const distance = Number(path?.distance ?? transit?.distance ?? 0);
  const duration = Number(path?.cost?.duration ?? transit?.cost?.duration ?? 0);

  let coordinates: [number, number][] = [];
  if (path?.steps?.length) {
    coordinates = path.steps.flatMap((step) => parsePolyline(step.polyline));
  } else if (transit?.segments?.length) {
    coordinates = transit.segments.flatMap((segment) => [
      ...(segment.walking?.steps || []).flatMap((step) => parsePolyline(step.polyline)),
      ...(segment.bus?.buslines || []).flatMap((line) => parsePolyline(line.polyline)),
    ]);
  }

  if (!distance || !duration) {
    throw Object.assign(new Error('No route found'), { status: 404 });
  }

  if (coordinates.length === 0) {
    coordinates = [[origin.lat, origin.lng], [destination.lat, destination.lng]];
  }

  const walkingDuration = profile === 'walking' ? duration : distance / (5000 / 3600);
  const drivingDuration = profile === 'driving' ? duration : distance / (30000 / 3600);

  return {
    coordinates,
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
    walkingText: formatDuration(walkingDuration),
    drivingText: formatDuration(drivingDuration),
  };
}

export async function calculateAmapRoute(
  userId: number,
  waypoints: RouteWaypoint[],
  profile: RouteProfile = 'driving',
): Promise<RouteResult> {
  validateWaypoints(waypoints);

  let distance = 0;
  let duration = 0;
  const coordinates: [number, number][] = [];

  for (let i = 0; i < waypoints.length - 1; i++) {
    const leg = await fetchAmapLeg(userId, waypoints[i], waypoints[i + 1], profile);
    distance += leg.distance;
    duration += leg.duration;
    coordinates.push(...(i === 0 ? leg.coordinates : leg.coordinates.slice(1)));
  }

  const walkingDuration = profile === 'walking' ? duration : distance / (5000 / 3600);
  const drivingDuration = profile === 'driving' ? duration : distance / (30000 / 3600);

  return {
    coordinates,
    distance,
    duration,
    distanceText: formatDistance(distance),
    durationText: formatDuration(duration),
    walkingText: formatDuration(walkingDuration),
    drivingText: formatDuration(drivingDuration),
  };
}

export async function calculateAmapSegments(userId: number, waypoints: RouteWaypoint[]): Promise<RouteSegment[]> {
  validateWaypoints(waypoints);

  const segments: RouteSegment[] = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const from: [number, number] = [waypoints[i].lat, waypoints[i].lng];
    const to: [number, number] = [waypoints[i + 1].lat, waypoints[i + 1].lng];
    const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const [walking, driving] = await Promise.all([
      fetchAmapLeg(userId, waypoints[i], waypoints[i + 1], 'walking'),
      fetchAmapLeg(userId, waypoints[i], waypoints[i + 1], 'driving'),
    ]);
    segments.push({
      mid,
      from,
      to,
      walkingText: walking.durationText,
      drivingText: driving.durationText,
    });
  }

  return segments;
}
