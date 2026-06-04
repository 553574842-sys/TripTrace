import { forwardRef, useImperativeHandle, useRef } from 'react'
import JourneyMap, { type JourneyMapHandle } from './JourneyMap'

export type JourneyMapAutoHandle = JourneyMapHandle

interface MapEntry {
  id: string
  lat: number
  lng: number
  title?: string | null
  location_name?: string | null
  mood?: string | null
  entry_date: string
  dayColor?: string
  dayLabel?: number
}

interface Props {
  checkins: unknown[]
  entries: MapEntry[]
  trail?: { lat: number; lng: number }[]
  height?: number
  dark?: boolean
  activeMarkerId?: string | null
  onMarkerClick?: (id: string, type?: string) => void
  fullScreen?: boolean
  paddingBottom?: number
}

const JourneyMapAuto = forwardRef<JourneyMapAutoHandle, Props>(function JourneyMapAuto(props, ref) {
  const leafletRef = useRef<JourneyMapHandle>(null)

  useImperativeHandle(ref, () => ({
    highlightMarker: (id) => leafletRef.current?.highlightMarker(id),
    focusMarker: (id) => leafletRef.current?.focusMarker(id),
    invalidateSize: () => leafletRef.current?.invalidateSize(),
  }), [])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <JourneyMap ref={leafletRef} {...(props as any)} />
})

export default JourneyMapAuto
