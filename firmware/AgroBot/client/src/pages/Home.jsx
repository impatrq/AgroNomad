import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, Polyline, useMap } from 'react-leaflet'
import RenameAnimalModal from '../components/RenameAnimalModal'

function FlyToSelected({ position }) {
  const map = useMap()

  useEffect(() => {
    if (position && position[0] !== 0) {
      map.flyTo(position, map.getZoom(), { duration: 0.5 })
    }
  }, [map, position])

  return null
}

{/* Function to normalize boundary groups from the payload */}
function normalizeBoundaryGroups(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }

  const rawGroups = payload.limitsField || payload.limits || payload.boundaries || payload.boundaryFields || payload.fields

  if (!rawGroups || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) {
    return []
  }

  return Object.entries(rawGroups)
    .map(([name, points]) => {
      if (!points || typeof points !== 'object' || Array.isArray(points)) {
        return null
      }

      const positions = Object.values(points)
        .map((point) => {
          if (!point || typeof point !== 'object' || Array.isArray(point)) {
            return null
          }

          const lat = Number(point.lat ?? point.LAT ?? point.latitude ?? point.Latitude)
          const lng = Number(point.lng ?? point.LNG ?? point.long ?? point.LONG ?? point.longitude ?? point.Longitude)

          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return null
          }

          return [lat, lng]
        })
        .filter(Boolean)

      if (positions.length < 2) {
        return null
      }

      const closedPositions = positions[0].toString() !== positions[positions.length - 1].toString()
        ? [...positions, positions[0]]
        : positions

      return { name, positions: closedPositions }
    })
    .filter(Boolean)
}

export default function Home({ onNavigate }) {
  /*
    # Object with data of each animal (coming from server -> /api/animals).
    # Including id, name, lat, lng, temp, hb.
    # Example(data from server):
      {"animals": 
        [ 
          {
            "id":"COLLAR-01",
            "name":"Lora",
            "lat":-34.707652,
            "lng":-58.2423,
            "temp":"38.4",
            "hb":"72"
          },
          {
            "id":"COLLAR-02",
            "name":"Lola",
            "lat":-34.707546,
            "lng":-58.239348,
            "temp":"38.1",
            "hb":"68"
          },
          {
            "id":"COLLAR-03",
            "name":"Luna",
            "lat":-34.709948,
            "lng":-58.24287,
            "temp":"38.7",
            "hb":"75"
          }
        ]
      }
  */
  const [animals, setAnimals] = useState([])
  /*
    # Object with data of boundaries for each yard which the user has(coming from the server -> /api/yards).
    # Including name and positions(array of lat,lng).
    # Example(data from server):
      {"limitsField":
        {
        "LimitsField2":
          {
          "limit1":{"lat":-34.702611,"lng":-58.256803},
          "limit2":{"lat":-34.698916,"lng":-58.249276},
          "limit3":{"lat":-34.701257,"lng":-58.245205},
          "limit4":{"lat":-34.706142,"lng":-58.253289}
          },
        "limitsField1":
          {
          "limit1":{"lat":-34.712444,"lng":-58.253289},
          "limit2":{"lat":-34.707743,"lng":-58.237085},
          "limit3":{"lat":-34.701257,"lng":-58.245205},
          "limit4":{"lat":-34.706142,"lng":-58.253289}
          }
        }
      }
  */
  const [yardBoundaries, setyardBoundaries] = useState([])
  
  // State which stores which animal is selected to be zoom in the map.
  const [selectedAnimal, setSelectedAnimal] = useState(null)

  const [loading, setLoading] = useState(true)// State to show 'loading' to user.
  const [error, setError] = useState(null)// State to show 'error' to user.
  
  const [menuOpen, setMenuOpen] = useState(false)// Menu open/close.
  const [renameModalOpen, setRenameModalOpen] = useState(false)// Rename animal modal open/close.
  
  const selectedAnimalRef = useRef(null)// 

  /*
    The selectedAnimal state is updated when an animal is clicked on the map, but we also want to keep track of the previously selected animal when the data is refreshed.
  */
  useEffect(() => {
    selectedAnimalRef.current = selectedAnimal
  }, [selectedAnimal])
  /* 
    The useEffect hook is used to fetch animal data from the server when the component mounts and every 15 seconds thereafter.
    It also handles loading and error states, and normalizes the data received from the server.
    The interval is cleared when the component unmounts to prevent memory leaks.
  */
  useEffect(() => {
    let isMounted = true

    async function loadAnimalData() {
      setLoading(true)
      setError(null)

      try {
        
        const response = await fetch('/api/animals')
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const rawAnimals = Array.isArray(data)
          ? data
          : Array.isArray(data?.animals)
            ? data.animals
            : []

        if (!Array.isArray(rawAnimals)) {
          throw new Error('Invalid data format')
        }

        const normalized = rawAnimals.map((item) => ({
          id: String(item.ID || item.id || ''),
          name: item.NAME || item.name || `Animal ${item.ID || item.id}`,
          lat: Number(item.LAT || item.lat || 0),
          lng: Number(item.LONG || item.long || item.lng || 0),
          temp: String(item.TEMP || item.temp || ''),
          hb: String(item.HB || item.hb || ''),
        }))

        if (!isMounted) return

        const previouslySelectedId = selectedAnimalRef.current?.id

        setAnimals(normalized)
        setyardBoundaries(normalizeBoundaryGroups(data))

        if (normalized.length > 0) {
          const stillSelected = normalized.find((animal) => animal.id === previouslySelectedId)
          setSelectedAnimal(stillSelected || normalized[0])
        } else {
          setSelectedAnimal(null)
        }

        setLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Load error:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    loadAnimalData()
   
    const interval = setInterval(loadAnimalData, 15000)// Refresh data every 15 seconds
    /*
     Later we have to implement a websocket connection to receive real-time updates from the server, 
     instead of polling every 15 seconds. This will improve performance and reduce server load.
    */

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])









  // Function to scroll to a specific section and close the menu
  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMenuOpen(false)
  }



  /*
    Handle renaming an animal by sending a request to the server and updating the local state accordingly.
  */
  const handleRenameAnimal = async (newName) => {
    if (!selectedAnimal) {
      throw new Error('No hay un animal seleccionado.')
    }

    const response = await fetch('/api/animals/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedAnimal.id, name: newName }),
    })

    if (!response.ok) {
      throw new Error('No se pudo actualizar el nombre en el servidor.')
    }

    const result = await response.json().catch(() => ({}))
    if (result?.status !== 'ok') {
      throw new Error('El servidor no confirmó el cambio.')
    }

    //Update view for the user 

    setAnimals((prevAnimals) =>
      prevAnimals.map((animal) => (animal.id === selectedAnimal.id ? { ...animal, name: newName } : animal))
    )
    setSelectedAnimal((prevSelected) =>
      prevSelected && prevSelected.id === selectedAnimal.id ? { ...prevSelected, name: newName } : prevSelected
    )
  }













  // Determine the map's center position based on the selected animal or default to the first animal  
  const mapPosition = useMemo(() => {
    if (selectedAnimal?.lat && selectedAnimal?.lng) {
      // If an animal is selected, center the map on that animal's position
      return [selectedAnimal.lat, selectedAnimal.lng]
    }
    if (animals.length > 0) {
      // If no animal is selected, default to the first animal's position
      return [animals[0].lat, animals[0].lng]
    }
    return [51.505, -0.09] // Default position (London) if no animals are available
  }, [selectedAnimal, animals])









  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header and navigation */}
      <header className="sticky top-0 z-60 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
          
          {/* Logo and title */}
          <div className="flex items-center gap-3">
            <img src="/logo.jpeg" alt="Logo" className="h-12 w-12 rounded-full object-cover" />
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Agro<span className="text-emerald-600">Nomad</span></h1>
              <p className="text-sm text-slate-500">Seguimiento de ganado con datos GPS.</p>
            </div>
          </div>
           {/* Menu button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen((prev) => !prev)}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
              aria-expanded={menuOpen}
            >
              {menuOpen ? 'Cerrar' : 'Menú'}
            </button>
          </div>
        </div>
        {/* Menu items */}
        {/* View map, details, user configuration */}
        {menuOpen && (
          <div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={() => scrollToSection('map-section')}
              className="rounded-full bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
            >
              Ver mapa
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('overview-section')}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Detalles
            </button>
            <button
              type="button"
              onClick={() => onNavigate?.('/userconf')}
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Configuración de usuario
            </button>
          </div>
        )}
      </header>
      
      {/* Main content */}

      <section className="py-10 px-4 sm:px-6 lg:px-8">

        <div className="max-w-6xl mx-auto space-y-8">
          <div id="map-section" className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
            {/* Map header and status of animals(detected and focused)*/}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              
              <div>
                <h2 className="text-2xl font-semibold">Mapa</h2>
                <p className="mt-1 text-sm text-slate-500">Toca un animal para ver sus detalles.</p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                <span>
                  {loading && 'Cargando...'}

                  {!loading && !error && `${animals.length} animales detectados`}
                  
                  {error && `Error: ${error}`}
                </span>
                
                {!loading && !error && (
                  <span className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
                )}

              </div>

              <div className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
                
                <span>
                  {!loading && !error && selectedAnimal ? (
                    <>Animal seleccionado <strong> {selectedAnimal.name}(ID:{selectedAnimal.id})</strong></>
                  ) : (
                    'Ningun animal seleccionado.'
                  )}
                </span>
                

                {!loading && !error && (
                  <span className="h-3 w-3 rounded-full bg-orange-500 ring-2 ring-orange-100" />
                )}
              </div>

            </div>



            {/* Map container */}

            <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 relative z-0">
              <MapContainer
                center={mapPosition}
                zoom={15}
                scrollWheelZoom
                className="h-140 w-full relative z-0"
                style={{ zIndex: 0 }}
              >
                {/* Use Esri World Imagery tiles for a satellite view */}
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
                      //Circle marker function works weel when styles are passed via pathOptions, 
                      // but if you use style prop it doesn't work, so we use pathOptions instead of style
                      pathOptions={{
                      fillColor: isSelected ? '#f59e0b' : '#05960c',
                      color: isSelected ? '#f59e0b' : '#ffffff',
                      weight: isSelected ? 3 : 2,
                      fillOpacity: 0.95,
                    }}
                      eventHandlers={{ click: () => setSelectedAnimal(animal) }}
                    >
                      {/* Show the animal's name in a tooltip when hovering over the marker */}
                      <Tooltip>{animal.name}</Tooltip>
                    </CircleMarker>
                  )
                })}
              </MapContainer>
            </div>
          </div>

          {/* Overview and selected animal details */}
          <div className="grid gap-6 xl:grid-cols-[1.5fr_0.9fr]">
            <div id="overview-section" className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Visión general</h3>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl bg-slate-100 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Total de animales</p>
                  <p className="mt-2 text-1xl font-semibold text-slate-900">{animals.length}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-5">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Estado</p>
                  <p className="mt-2 text-1xl font-semibold text-slate-900">{error ? 'Error' : loading ? 'Cargando' : 'OK'}</p>
                </div>
              </div>
            </div>
            
            {/* Selected animal details */}
            <aside className="space-y-6">
              <div id="details-section" className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
                <h3 className="text-xl font-semibold">Animal selecionado</h3>
                <div className="mt-4 space-y-3">
                  {selectedAnimal ? (
                    <div className="space-y-3">
                      
                      <div className="rounded-3xl bg-slate-100 p-4">
                        <p className="text-sm text-slate-500">ID(identificador unico de collar)</p>
                        <p className="mt-1 text-lg font-semibold">{selectedAnimal.id}</p>
                      </div>
                      
                      <div className="rounded-3xl bg-slate-100 p-4">
                        <p className="text-sm  text-slate-500">Nombre</p>
                        
                        
                        
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="mt-1 text-lg font-semibold">{selectedAnimal.name}</p>
                          {/* Button to edit name of animal*/}
                          <button
                            type="button"
                            onClick={() => setRenameModalOpen(true)}
                            className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-700"
                          >
                            Editar
                          </button>
                        </div>
                      </div>
                      {/* Show the animal's temperature and position 
                      
                      <div className="rounded-3xl bg-slate-100 p-4">
                        <p className="text-sm  text-slate-500">Temperatura</p>
                        <p className="mt-1 text-lg font-semibold">{selectedAnimal.temp || '—'}</p>
                      </div>
                      
                      */}
                      
                      <div className="rounded-3xl bg-slate-100 p-4">
                        <p className="text-sm  text-slate-500">Posicion</p>
                        {/*show also the place where that coordenates point(example:Buenos aires,argenina) */}
                        <div className="mt-2 flex items-center justify-between gap-2">

                        
                          <div>
                            <p className="mt-1 text-sm font-mono mb-2">Buenos Aires, Argentina</p>
                            <p className="mt-1 text-sm font-mono">Latitud: {selectedAnimal.lat.toFixed(5)}</p>
                            <p className="mt-1 text-sm font-mono"> Longitud: {selectedAnimal.lng.toFixed(5)}</p>
                          </div>

                          {/* button to copy coordenates to clipboard */}
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(`Latitud: ${selectedAnimal.lat.toFixed(5)}, Longitud: ${selectedAnimal.lng.toFixed(5)}`)
                              alert('Coordenadas copiadas al portapapeles')
                            }}
                            className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-700"
                          >
                            Copiar
                          </button>
                        </div>
                          
                        {/* Button to show historical trip of the animal */}
                        <div className="mt-5 flex items-center justify-center rounded-3xl bg-emerald-600 p-4">
                          <button
                            type="button"
                            onClick={() => onNavigate?.(`/history/${selectedAnimal.id}`)}
                            className="rounded-md px-3 py-1.5 text-m font-semibold text-emerald-50 transition-colors"
                          >
                            Ver trayecto historico
                          </button>
                        </div>

                      </div>

                      
                    </div>
                  ) : (
                    <p className="text-slate-500 text-center py-4">Tocar sobre animal para ver detalles</p>
                  )}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <RenameAnimalModal
        animal={selectedAnimal}
        isOpen={renameModalOpen}
        onClose={() => setRenameModalOpen(false)}
        onConfirm={handleRenameAnimal}
      />
    </div>
  )
}
