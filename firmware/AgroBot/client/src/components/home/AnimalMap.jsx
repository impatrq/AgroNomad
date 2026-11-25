import { useEffect, useMemo, useRef, useState } from 'react'
import { divIcon } from 'leaflet'
import { AlertTriangle, X } from 'lucide-react'
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { hasValidAnimalPosition } from '../../lib/utils'

const MIN_REFERENCE_TEMPERATURE = 38
const MAX_REFERENCE_TEMPERATURE = 39.5
const OUTSIDE_FIELD_DELAY_MS = 10_000
const COLLAR_OFFLINE_DELAY_MS = 15_000

function TemperatureAlert({ alert }) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <article
      role="status"
      className="pointer-events-auto flex gap-3 rounded-2xl border border-amber-200 bg-white/95 p-4 text-slate-800 shadow-lg backdrop-blur"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Revisión de bienestar</p>
        <p className="mt-1 text-sm">
          {alert.animal.name}: temperatura de {alert.temperature} °C, fuera del rango de referencia
          ({MIN_REFERENCE_TEMPERATURE}–{MAX_REFERENCE_TEMPERATURE} °C).
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Se recomienda verificar la medición y revisar al animal.
        </p>
      </div>
      <button
        type="button"
        aria-label={`Descartar alerta de ${alert.animal.name}`}
        title="Descartar alerta"
        onClick={() => setDismissed(true)}
        className="h-fit rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-amber-600"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  )
}

function GeofenceAlert({ alert, onDismiss }) {
  return (
    <article
      role="alert"
      className="pointer-events-auto flex gap-3 rounded-2xl border border-red-300 bg-white/95 p-4 text-slate-800 shadow-lg backdrop-blur"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-red-700">Alerta de perímetro</p>
        <p className="mt-1 text-sm">
          {alert.animalName} se encuentra fuera del campo {alert.yardName}.
        </p>
      </div>
      <button
        type="button"
        aria-label={`Descartar alerta de perímetro de ${alert.animalName}`}
        title="Descartar alerta"
        onClick={() => onDismiss(alert.key)}
        className="h-fit rounded-lg p-1 text-slate-500 transition hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-red-600"
      >
        <X aria-hidden="true" className="h-4 w-4" />
      </button>
    </article>
  )
}

function UnassignedCollarsAlert({ collarIds }) {
  return (
    <article
      role="status"
      className="unassigned-collars-alert pointer-events-auto flex gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur"
    >
      <AlertTriangle aria-hidden="true" className="unassigned-collars-icon mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="unassigned-collars-title font-semibold">Collares sin campo asignado</p>
        <p className="unassigned-collars-body mt-1 break-words text-sm">
          ID{collarIds.length === 1 ? '' : 's'}: {collarIds.join(', ')}
        </p>
        <p className="unassigned-collars-hint mt-1 text-xs">
          Asigná estos collares a un campo desde Información de campos.
        </p>
      </div>
    </article>
  )
}

function OfflineCollarsAlert({ collarIds }) {
  return (
    <article
      role="status"
      className="offline-collars-alert pointer-events-auto flex gap-3 rounded-2xl border p-4 shadow-lg backdrop-blur"
    >
      <AlertTriangle aria-hidden="true" className="offline-collars-icon mt-0.5 h-5 w-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="offline-collars-title font-semibold">Sin conexión con los collares</p>
        <p className="offline-collars-body mt-1 break-words text-sm">
          Sin señal: {collarIds.join(', ')}.
        </p>
      </div>
    </article>
  )
}

function isPointOnSegment(point, start, end) {
  const [latitude, longitude] = point
  const [startLatitude, startLongitude] = start
  const [endLatitude, endLongitude] = end
  const cross =
    (longitude - startLongitude) * (endLatitude - startLatitude) -
    (latitude - startLatitude) * (endLongitude - startLongitude)

  if (Math.abs(cross) > 1e-10) return false

  return longitude >= Math.min(startLongitude, endLongitude) - 1e-10 &&
    longitude <= Math.max(startLongitude, endLongitude) + 1e-10 &&
    latitude >= Math.min(startLatitude, endLatitude) - 1e-10 &&
    latitude <= Math.max(startLatitude, endLatitude) + 1e-10
}

function isPointInsideBoundary([latitude, longitude], positions) {
  let inside = false

  for (let index = 0, previousIndex = positions.length - 1; index < positions.length; previousIndex = index, index += 1) {
    const start = positions[index]
    const end = positions[previousIndex]
    if (isPointOnSegment([latitude, longitude], start, end)) return true

    const crossesLatitude = (start[0] > latitude) !== (end[0] > latitude)
    if (
      crossesLatitude &&
      longitude <
        ((end[1] - start[1]) * (latitude - start[0])) / (end[0] - start[0]) + start[1]
    ) {
      inside = !inside
    }
  }

  return inside
}

function getBearing([startLat, startLng], [endLat, endLng]) {
  const toRadians = (degrees) => (degrees * Math.PI) / 180
  const toDegrees = (radians) => (radians * 180) / Math.PI
  const startLatitude = toRadians(startLat)
  const endLatitude = toRadians(endLat)
  const longitudeDifference = toRadians(endLng - startLng)
  const y = Math.sin(longitudeDifference) * Math.cos(endLatitude)
  const x =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDifference)

  return (toDegrees(Math.atan2(y, x)) + 360) % 360
}

function createDirectionIcon(bearing) {
  return divIcon({
    className: 'history-direction-icon',
    html: `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" style="transform: rotate(${bearing}deg)">
      <path d="M12 2 21 22 12 17 3 22 12 2Z" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5" stroke-linejoin="round" />
    </svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

function FitAnimalPositions({ animals }) {
  const map = useMap()
  const hasFittedInitialPositions = useRef(false)

  useEffect(() => {
    if (hasFittedInitialPositions.current) return

    const positionedAnimals = animals.filter(hasValidAnimalPosition)
    if (positionedAnimals.length === 0) return

    const positions = positionedAnimals.map((animal) => [animal.lat, animal.lng])
    if (positions.length === 1) {
      map.setView(positions[0], 18)
    } else {
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 18 })
    }

    hasFittedInitialPositions.current = true
  }, [animals, map])

  return null
}

export default function AnimalMap({
  animals,
  selectedAnimal,
  onSelectAnimal,
  yardBoundaries,
  mapPosition,
  historyPositions = [],
}) {
  const positionedAnimals = useMemo(
    () => animals.filter(hasValidAnimalPosition),
    [animals]
  )

  const historyPath = useMemo(
    () => {
      const positions = historyPositions.map((position) => [position.lat, position.lng])
      if (
        selectedAnimal?.hasPosition !== false &&
        hasValidAnimalPosition(selectedAnimal)
      ) {
        const currentPosition = [selectedAnimal.lat, selectedAnimal.lng]
        const lastPosition = positions.at(-1)
        if (
          !lastPosition ||
          lastPosition[0] !== currentPosition[0] ||
          lastPosition[1] !== currentPosition[1]
        ) {
          positions.push(currentPosition)
        }
      }
      return positions
    },
    [historyPositions, selectedAnimal]
  )

  const temperatureAlerts = useMemo(
    () =>
      animals.flatMap((animal) => {
        const rawTemperature = animal.temp?.trim()
        if (!rawTemperature) return []

        const temperature = Number(rawTemperature)
        if (
          !Number.isFinite(temperature) ||
          temperature <= 0 ||
          (temperature >= MIN_REFERENCE_TEMPERATURE && temperature <= MAX_REFERENCE_TEMPERATURE)
        ) {
          return []
        }

        return [{
          animal,
          temperature,
          type: temperature > MAX_REFERENCE_TEMPERATURE ? 'high' : 'low',
        }]
      }),
    [animals]
  )

  const unassignedCollarIds = useMemo(
    () =>
      animals
        .filter((animal) => animal.hasCollar && animal.yardId == null)
        .map((animal) => animal.id),
    [animals]
  )

  const [offlineCollarIds, setOfflineCollarIds] = useState([])
  const firstObservedAtRef = useRef(new Map())
  const animalsRef = useRef(animals)

  useEffect(() => {
    animalsRef.current = animals
  }, [animals])

  useEffect(() => {
    const checkOfflineCollars = () => {
      const collarIds = []
      const currentCollarIds = new Set()
      const now = Date.now()

      for (const animal of animalsRef.current) {
        if (!animal.hasCollar) continue

        currentCollarIds.add(animal.id)
        const lastSeenAt = animal.lastSeenAt ? new Date(animal.lastSeenAt).getTime() : Number.NaN
        if (Number.isFinite(lastSeenAt)) {
          firstObservedAtRef.current.delete(animal.id)
          if (now - lastSeenAt >= COLLAR_OFFLINE_DELAY_MS) collarIds.push(animal.id)
        } else {
          if (!firstObservedAtRef.current.has(animal.id)) {
            firstObservedAtRef.current.set(animal.id, now)
          }
          if (now - firstObservedAtRef.current.get(animal.id) >= COLLAR_OFFLINE_DELAY_MS) {
            collarIds.push(animal.id)
          }
        }
      }

      for (const collarId of firstObservedAtRef.current.keys()) {
        if (!currentCollarIds.has(collarId)) firstObservedAtRef.current.delete(collarId)
      }

      setOfflineCollarIds(collarIds)
    }

    const intervalId = window.setInterval(checkOfflineCollars, 1000)
    return () => window.clearInterval(intervalId)
  }, [])

  const [geofenceAlerts, setGeofenceAlerts] = useState([])
  const outsideSinceRef = useRef(new Map())
  const dismissedGeofenceAlertsRef = useRef(new Set())

  useEffect(() => {
    const checkGeofences = () => {
      const currentAnimalKeys = new Set()
      const activeAlerts = new Map()
      const now = Date.now()

      for (const animal of animals) {
        if (animal.yardId == null || !hasValidAnimalPosition(animal)) continue

        const boundary = yardBoundaries.find(
          (yard) => String(yard.id) === String(animal.yardId)
        )
        if (!boundary || boundary.positions.length < 3) continue

        const key = `${animal.id}:${boundary.id}`
        currentAnimalKeys.add(key)

        if (isPointInsideBoundary([animal.lat, animal.lng], boundary.positions)) {
          outsideSinceRef.current.delete(key)
          dismissedGeofenceAlertsRef.current.delete(key)
          continue
        }

        if (!outsideSinceRef.current.has(key)) {
          outsideSinceRef.current.set(key, now)
        }

        if (
          now - outsideSinceRef.current.get(key) >= OUTSIDE_FIELD_DELAY_MS &&
          !dismissedGeofenceAlertsRef.current.has(key)
        ) {
          activeAlerts.set(key, {
            key,
            animalName: animal.name,
            yardName: boundary.name,
          })
        }
      }

      for (const key of outsideSinceRef.current.keys()) {
        if (!currentAnimalKeys.has(key)) {
          outsideSinceRef.current.delete(key)
          dismissedGeofenceAlertsRef.current.delete(key)
        }
      }

      setGeofenceAlerts((currentAlerts) => {
        const nextAlerts = [...activeAlerts.values()]
        if (
          currentAlerts.length === nextAlerts.length &&
          currentAlerts.every((alert, index) =>
            alert.key === nextAlerts[index]?.key &&
            alert.animalName === nextAlerts[index]?.animalName &&
            alert.yardName === nextAlerts[index]?.yardName
          )
        ) {
          return currentAlerts
        }
        return nextAlerts
      })
    }

    checkGeofences()
    const intervalId = window.setInterval(checkGeofences, 500)
    return () => window.clearInterval(intervalId)
  }, [animals, yardBoundaries])

  return (
    <div className="relative z-0 mt-6 overflow-hidden rounded-3xl border border-slate-200">
      {(temperatureAlerts.length > 0 ||
        geofenceAlerts.length > 0 ||
        unassignedCollarIds.length > 0 ||
        offlineCollarIds.length > 0) && (
        <div
          aria-label="Alertas de bienestar"
          aria-live="polite"
          className="pointer-events-none absolute inset-x-3 top-3 z-[1000] flex max-h-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto sm:left-auto sm:right-3 sm:w-[22rem]"
        >
          {temperatureAlerts.map((alert) => (
            <TemperatureAlert
              key={`${alert.animal.id}-${alert.type}`}
              alert={alert}
            />
          ))}
          {geofenceAlerts.map((alert) => (
            <GeofenceAlert
              key={alert.key}
              alert={alert}
              onDismiss={(key) => {
                dismissedGeofenceAlertsRef.current.add(key)
                setGeofenceAlerts((currentAlerts) =>
                  currentAlerts.filter((currentAlert) => currentAlert.key !== key)
                )
              }}
            />
          ))}
          {unassignedCollarIds.length > 0 && (
            <UnassignedCollarsAlert collarIds={unassignedCollarIds} />
          )}
          {offlineCollarIds.length > 0 && (
            <OfflineCollarsAlert collarIds={offlineCollarIds} />
          )}
        </div>
      )}
      <MapContainer
        center={mapPosition}
        zoom={18}
        scrollWheelZoom
        className="h-140 w-full relative z-0"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          maxZoom={22}
          maxNativeZoom={19}
        />
        <FitAnimalPositions animals={positionedAnimals} />

        {yardBoundaries.map((boundary) => (
          <Polygon
            key={boundary.id ?? boundary.name}
            positions={boundary.positions}
            pathOptions={{
              color: '#16a34a',
              weight: 2,
              opacity: 0.8,
              fillColor: '#22c55e',
              fillOpacity: 0,
              dashArray: '10 8',
              lineCap: 'butt',
            }}
          >
            <Tooltip>{boundary.name}</Tooltip>
          </Polygon>
        ))}

        {historyPath.length > 1 && (
          <Polyline
            positions={historyPath}
            pathOptions={{
              color: '#38bdf8',
              weight: 2,
              opacity: 0.65,
            }}
          />
        )}

        {historyPath.slice(1).map((position, index) => {
          const previousPosition = historyPath[index]
          const center = [
            (previousPosition[0] + position[0]) / 2,
            (previousPosition[1] + position[1]) / 2,
          ]
          const bearing = getBearing(previousPosition, position)

          return (
            <Marker
              key={`history-direction-${index}`}
              position={center}
              icon={createDirectionIcon(bearing)}
              interactive={false}
              keyboard={false}
            />
          )
        })}

        {historyPath.map((position, index) => (
          <CircleMarker
            key={`history-${position[0]}-${position[1]}-${index}`}
            center={position}
            radius={2}
            pathOptions={{
              fillColor: '#2563eb',
              color: '#ffffff',
              weight: 2,
              fillOpacity: 0.95,
            }}
          />
        ))}

        {positionedAnimals.map((animal) => {
          const isSelected = animal.id === selectedAnimal?.id
          const hasCurrentPosition = animal.hasPosition !== false

          return (
            <CircleMarker
              key={animal.id}
              center={[animal.lat, animal.lng]}
              radius={hasCurrentPosition ? 5 : 7}
              pathOptions={{
                fillColor: hasCurrentPosition ? (isSelected ? '#f59e0b' : '#05960c') : '#94a3b8',
                color: hasCurrentPosition ? (isSelected ? '#f59e0b' : '#ffffff') : '#334155',
                weight: hasCurrentPosition ? (isSelected ? 3 : 2) : 3,
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelectAnimal(animal) }}
            >
              <Tooltip>
                {hasCurrentPosition
                  ? animal.name
                  : `${animal.name} — última posición conocida; sin coordenadas actuales`}
              </Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
