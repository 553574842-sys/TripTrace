import { MapView } from './MapView'

// Domestic build: keep the planner on the local Leaflet renderer while route
// calculation and external navigation use Amap through the backend.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MapViewAuto(props: any) {
  return <MapView {...props} />
}
