import { useEffect, useMemo, useRef } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { hasValidAnimalPosition } from '../../lib/utils'

function FitAnimalPositions({ animals }) {
  const map = useMap()
  const previousPositionsKey = useRef('')

  useEffect(() => {
    const positionedAnimals = animals.filter(hasValidAnimalPosition)
    const positionsKey = positionedAnimals
      .map((animal) => `${animal.id}:${animal.lat}:${animal.lng}`)
      .join('|')

    if (positionsKey === previousPositionsKey.current) return
    previousPositionsKey.current = positionsKey

    const positions = positionedAnimals.map((animal) => [animal.lat, animal.lng])
    if (positions.length === 1) {
      map.setView(positions[0], 18)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 18 })
    }
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
    () => historyPositions.map((position) => [position.lat, position.lng]),
    [historyPositions]
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
          <Polyline
            key={boundary.name}
            positions={boundary.positions}
            pathOptions={{ color: '#56eb2575', weight: 2, opacity: 0.65 , dashArray: '4 6'}}
          >
            <Tooltip>{boundary.name}</Tooltip>
          </Polyline>
        ))}

        {historyPath.length > 1 && (
          <Polyline
            positions={historyPath}
            pathOptions={{
              color: '#38bdf8',
              weight: 3,
              opacity: 0.95,
              dashArray: '6 8',
            }}
          />
        )}

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
