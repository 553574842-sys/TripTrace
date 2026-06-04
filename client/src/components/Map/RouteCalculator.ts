import { mapsApi } from '../../api/client'
import type { RouteResult, RouteSegment, Waypoint } from '../../types'

type RouteProfile = 'driving' | 'walking' | 'transit'

export async function calculateRoute(
  waypoints: Waypoint[],
  profile: RouteProfile = 'driving',
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteResult> {
  if (!waypoints || waypoints.length < 2) {
    throw new Error('At least 2 waypoints required')
  }

  return mapsApi.route(waypoints, profile, signal) as Promise<RouteResult>
}

export function generateAmapUrl(places: Waypoint[]): string | null {
  const valid = places.filter((p) => p.lat && p.lng)
  if (valid.length === 0) return null

  if (valid.length === 1) {
    const point = valid[0]
    return `https://uri.amap.com/marker?position=${point.lng},${point.lat}`
  }

  const origin = valid[0]
  const destination = valid[valid.length - 1]
  const waypoints = valid.slice(1, -1).map((p) => `${p.lng},${p.lat}`).join(';')
  const params = new URLSearchParams({
    from: `${origin.lng},${origin.lat}`,
    to: `${destination.lng},${destination.lat}`,
    mode: 'car',
  })
  if (waypoints) params.set('via', waypoints)
  return `https://uri.amap.com/navigation?${params.toString()}`
}

export const generateGoogleMapsUrl = generateAmapUrl

export function optimizeRoute(places: Waypoint[]): Waypoint[] {
  const valid = places.filter((p) => p.lat && p.lng)
  if (valid.length <= 2) return places

  const visited = new Set<number>()
  const result: Waypoint[] = []
  let current = valid[0]
  visited.add(0)
  result.push(current)

  while (result.length < valid.length) {
    let nearestIdx = -1
    let minDist = Infinity
    for (let i = 0; i < valid.length; i++) {
      if (visited.has(i)) continue
      const d = Math.sqrt(
        Math.pow(valid[i].lat - current.lat, 2) + Math.pow(valid[i].lng - current.lng, 2)
      )
      if (d < minDist) { minDist = d; nearestIdx = i }
    }
    if (nearestIdx === -1) break
    visited.add(nearestIdx)
    current = valid[nearestIdx]
    result.push(current)
  }
  return result
}

export async function calculateSegments(
  waypoints: Waypoint[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<RouteSegment[]> {
  if (!waypoints || waypoints.length < 2) return []
  const data = await mapsApi.routeSegments(waypoints, signal) as { segments?: RouteSegment[] }
  return data.segments || []
}
