import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  calculateRoute,
  calculateSegments,
  optimizeRoute,
  generateAmapUrl,
  generateGoogleMapsUrl,
} from './RouteCalculator'
import { mapsApi } from '../../api/client'

vi.mock('../../api/client', () => ({
  mapsApi: {
    route: vi.fn(),
    routeSegments: vi.fn(),
  },
}))

const wp1 = { lat: 39.9042, lng: 116.4074 }
const wp2 = { lat: 31.2304, lng: 121.4737 }

beforeEach(() => {
  vi.mocked(mapsApi.route).mockReset()
  vi.mocked(mapsApi.routeSegments).mockReset()
})

describe('calculateRoute', () => {
  it('FE-COMP-ROUTECALCULATOR-001: throws when fewer than 2 waypoints', async () => {
    await expect(calculateRoute([wp1])).rejects.toThrow('At least 2 waypoints required')
  })

  it('FE-COMP-ROUTECALCULATOR-002: delegates route calculation to domestic maps API', async () => {
    const route = {
      coordinates: [[39.9042, 116.4074], [31.2304, 121.4737]],
      distance: 1000,
      duration: 120,
      distanceText: '1.0 km',
      durationText: '2 min',
      walkingText: '12 min',
      drivingText: '2 min',
    }
    vi.mocked(mapsApi.route).mockResolvedValue(route)

    await expect(calculateRoute([wp1, wp2], 'walking')).resolves.toEqual(route)
    expect(mapsApi.route).toHaveBeenCalledWith([wp1, wp2], 'walking', undefined)
  })
})

describe('calculateSegments', () => {
  it('FE-COMP-ROUTECALCULATOR-003: returns empty array for fewer than 2 waypoints', async () => {
    await expect(calculateSegments([wp1])).resolves.toEqual([])
  })

  it('FE-COMP-ROUTECALCULATOR-004: delegates segment calculation to domestic maps API', async () => {
    const segments = [{
      mid: [35.5673, 118.94055] as [number, number],
      from: [wp1.lat, wp1.lng] as [number, number],
      to: [wp2.lat, wp2.lng] as [number, number],
      walkingText: '10 h',
      drivingText: '5 h',
    }]
    vi.mocked(mapsApi.routeSegments).mockResolvedValue({ segments })

    await expect(calculateSegments([wp1, wp2])).resolves.toEqual(segments)
  })
})

describe('optimizeRoute', () => {
  it('FE-COMP-ROUTECALCULATOR-005: returns input unchanged for 2 or fewer places', () => {
    const places = [wp1, wp2]
    const result = optimizeRoute(places)
    expect(result).toHaveLength(2)
    expect(result).toBe(places)
  })

  it('FE-COMP-ROUTECALCULATOR-006: nearest-neighbor reorders 3 waypoints correctly', () => {
    const a = { lat: 1, lng: 1 }
    const b = { lat: 10, lng: 1 }
    const c = { lat: 2, lng: 1 }
    const result = optimizeRoute([a, b, c])
    expect(result[0]).toEqual(a)
    expect(result[1]).toEqual(c)
    expect(result[2]).toEqual(b)
  })
})

describe('generateAmapUrl', () => {
  it('FE-COMP-ROUTECALCULATOR-007: returns null for empty places', () => {
    expect(generateAmapUrl([])).toBeNull()
  })

  it('FE-COMP-ROUTECALCULATOR-008: single place returns Amap marker URL', () => {
    const result = generateAmapUrl([{ lat: 39.9, lng: 116.4 }])
    expect(result).toBe('https://uri.amap.com/marker?position=116.4,39.9')
  })

  it('FE-COMP-ROUTECALCULATOR-009: multiple places returns Amap navigation URL', () => {
    const result = generateAmapUrl([
      { lat: 39.9, lng: 116.4 },
      { lat: 31.2, lng: 121.4 },
    ])
    expect(result).toMatch(/^https:\/\/uri\.amap\.com\/navigation\?/)
    expect(result).toContain('from=116.4%2C39.9')
    expect(result).toContain('to=121.4%2C31.2')
  })

  it('FE-COMP-ROUTECALCULATOR-010: keeps legacy export alias pointed at Amap', () => {
    expect(generateGoogleMapsUrl([{ lat: 39.9, lng: 116.4 }])).toBe(generateAmapUrl([{ lat: 39.9, lng: 116.4 }]))
  })
})
