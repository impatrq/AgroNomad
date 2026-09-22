import { useEffect } from 'react'
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'

function FlyToSelected({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position && position[0] !== 0) {
      map.flyTo(position, map.getZoom(), { duration: 0.5 })
    }
  }, [map, position])

  return null
}

export default function AnimalMap({ animals, selectedAnimal, onSelectAnimal, yardBoundaries, mapPosition }) {
  return (
    <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 relative z-0">
      <MapContainer
        center={mapPosition}
        zoom={15}
        scrollWheelZoom
        className="h-140 w-full relative z-0"
        style={{ zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        />
        <FlyToSelected position={mapPosition} />

        {yardBoundaries.map((boundary) => (
          <Polyline
            key={boundary.name}
            positions={boundary.positions}
            pathOptions={{ color: '#2563eb', weight: 3, opacity: 0.95 }}
          >
            <Tooltip>{boundary.name}</Tooltip>
          </Polyline>
        ))}

        {animals.map((animal) => {
          const isSelected = animal.id === selectedAnimal?.id

          return (
            <CircleMarker
              key={animal.id}
              center={[animal.lat, animal.lng]}
              radius={7}
              pathOptions={{
                fillColor: isSelected ? '#f59e0b' : '#05960c',
                color: isSelected ? '#f59e0b' : '#ffffff',
                weight: isSelected ? 3 : 2,
                fillOpacity: 0.95,
              }}
              eventHandlers={{ click: () => onSelectAnimal(animal) }}
            >
              <Tooltip>{animal.name}</Tooltip>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
