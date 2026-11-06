import { useEffect, useMemo, useRef } from 'react'
import { divIcon } from 'leaflet'
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { hasValidAnimalPosition } from '../../lib/utils'

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

  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 relative z-0">
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
            key={boundary.name}
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
