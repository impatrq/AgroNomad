import { useEffect, useMemo, useState } from 'react'
import { CircleMarker, MapContainer, Polygon, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet'
import HeaderMain from '../components/HeaderMain'
import { apiUrl } from '../lib/api'

const DEFAULT_CENTER = [-34.71, -58.24]

function YardMapControls({ drawing, onAddPoint }) {
  useMapEvents({
    click(event) {
      if (drawing) onAddPoint([event.latlng.lat, event.latlng.lng])
    },
  })
  return null
}

function FitYardOnMap({ positions }) {
  const map = useMap()

  useEffect(() => {
    if (positions.length === 1) {
      map.setView(positions[0], 18)
    } else if (positions.length > 1) {
      map.fitBounds(positions, { padding: [32, 32], maxZoom: 18 })
    }
  }, [map, positions])

  return null
}

async function getErrorMessage(response) {
  const body = await response.json().catch(() => ({}))
  return body.message || `Error del servidor: ${response.status}`
}

export default function YardsConfig({ onNavigate }) {
  const [yards, setYards] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [draftName, setDraftName] = useState('')
  const [draftPositions, setDraftPositions] = useState([])
  const [drawing, setDrawing] = useState(false)
  const [editingYardId, setEditingYardId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    let active = true

    async function loadYards() {
      try {
        const response = await fetch(apiUrl('/api/yards'))
        if (!response.ok) throw new Error(await getErrorMessage(response))
        const data = await response.json()
        if (!Array.isArray(data.yards)) {
          throw new Error('La respuesta de yards no tiene el formato esperado.')
        }
        if (active) {
          setYards(data.yards)
          setSelectedId(data.yards[0] ? String(data.yards[0].id) : '')
        }
      } catch (loadError) {
        if (active) setError(loadError.message || 'No se pudieron cargar los yards.')
      } finally {
        if (active) setLoading(false)
      }
    }

    loadYards()
    return () => {
      active = false
    }
  }, [])

  const selectedYard = useMemo(
    () => yards.find((yard) => String(yard.id) === selectedId),
    [yards, selectedId]
  )

  const mapCenter = draftPositions[0] || selectedYard?.positions?.[0] || DEFAULT_CENTER

  const cancelDrawing = () => {
    setDrawing(false)
    setEditingYardId(null)
    setDraftPositions([])
    setDraftName('')
    setError('')
  }

  const startEditing = () => {
    setDraftPositions(selectedYard?.positions || [])
    setDraftName(selectedYard?.name || '')
    setEditingYardId(selectedYard?.id ?? null)
    setError('')
    setSuccess('')
    setDrawing(true)
  }

  const startCreating = () => {
    setSelectedId('')
    setEditingYardId(null)
    setDraftName('')
    setDraftPositions([])
    setError('')
    setSuccess('')
    setDrawing(true)
  }

  const saveYard = async (event) => {
    event.preventDefault()
    if (draftPositions.length < 3) {
      setError('Marcá al menos 3 puntos en el mapa para definir el límite.')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')
    try {
      const isExistingYard = editingYardId !== null
      const response = await fetch(
        apiUrl(isExistingYard ? `/api/yards/${editingYardId}` : '/api/yards'),
        {
          method: isExistingYard ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: draftName, positions: draftPositions }),
        }
      )
      if (!response.ok) throw new Error(await getErrorMessage(response))
      const result = await response.json()
      if (result.status !== 'ok' || !result.yard) {
        throw new Error('El servidor no confirmó el guardado del límite.')
      }

      setYards((currentYards) => {
        const nextYard = result.yard
        const exists = currentYards.some((yard) => String(yard.id) === String(nextYard.id))
        return exists
          ? currentYards.map((yard) =>
              String(yard.id) === String(nextYard.id) ? nextYard : yard
            )
          : [nextYard, ...currentYards]
      })
      setSelectedId(String(result.yard.id))
      setDrawing(false)
      setEditingYardId(null)
      setDraftPositions([])
      setDraftName('')
      setSuccess('Límite del yard guardado correctamente.')
    } catch (saveError) {
      setError(saveError.message || 'No se pudo guardar el límite.')
    } finally {
      setSaving(false)
    }
  }

  const deleteYard = async () => {
    if (!selectedYard || deleting) return
    if (!window.confirm(`¿Eliminar definitivamente el yard "${selectedYard.name}"?`)) return

    setDeleting(true)
    setError('')
    setSuccess('')
    try {
      const response = await fetch(apiUrl(`/api/yards/${selectedYard.id}`), {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))

      const remainingYards = yards.filter(
        (yard) => String(yard.id) !== String(selectedYard.id)
      )
      setYards(remainingYards)
      setSelectedId(remainingYards[0] ? String(remainingYards[0].id) : '')
      setSuccess(`Se eliminó el yard "${selectedYard.name}".`)
    } catch (deleteError) {
      setError(deleteError.message || 'No se pudo eliminar el yard.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <HeaderMain subtitle="Configurá los límites de tus yards." onNavigate={onNavigate} />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-semibold">Límites de los yards</h2>
                <p className="mt-2 max-w-2xl text-sm text-slate-600">
                  Elegí un yard y marcá sus vértices sobre el mapa. Hacé clic en al menos tres
                  puntos y guardá el polígono para que aparezca en el mapa principal.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={startCreating}
                  disabled={loading || drawing}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Crear yard
                </button>
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={loading || !selectedYard || drawing}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Editar límite
                </button>
                <button
                  type="button"
                  onClick={deleteYard}
                  disabled={loading || !selectedYard || drawing || deleting}
                  className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {deleting ? 'Eliminando…' : 'Eliminar yard'}
                </button>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1 text-sm font-medium text-slate-700">
                Yard
                <select
                  value={selectedId}
                  onChange={(event) => {
                    setSelectedId(event.target.value)
                    setSuccess('')
                  }}
                  disabled={loading || drawing || yards.length === 0}
                  className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-slate-900"
                >
                  {yards.length === 0 && <option value="">No hay yards cargados</option>}
                  {yards.map((yard) => (
                    <option key={yard.id} value={yard.id}>{yard.name}</option>
                  ))}
                </select>
              </label>
              {drawing && (
                <form onSubmit={saveYard} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="flex-1 text-sm font-medium text-slate-700">
                    Nombre
                    <input
                      value={draftName}
                      onChange={(event) => setDraftName(event.target.value)}
                      maxLength={100}
                      required
                      className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2.5"
                      placeholder="Ej. Potrero norte"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={saving || draftPositions.length < 3}
                    className="rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? 'Guardando…' : `Guardar (${draftPositions.length} puntos)`}
                  </button>
                  <button
                    type="button"
                    onClick={cancelDrawing}
                    disabled={saving}
                    className="rounded-full border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </form>
              )}
            </div>

            {drawing && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <span>Hacé clic en el mapa para agregar vértices. Podés arrastrar el mapa mientras configurás el perímetro.</span>
                <button
                  type="button"
                  onClick={() => setDraftPositions((points) => points.slice(0, -1))}
                  disabled={draftPositions.length === 0}
                  className="font-semibold underline disabled:opacity-50"
                >
                  Deshacer último punto
                </button>
              </div>
            )}

            {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            {success && <p role="status" className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</p>}
            {loading && <p className="mt-4 text-sm text-slate-500">Cargando yards…</p>}
          </section>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
            <MapContainer
              center={mapCenter}
              zoom={17}
              scrollWheelZoom
              className="h-[65vh] min-h-96 w-full"
            >
              <TileLayer
                attribution="&copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={22}
                maxNativeZoom={19}
              />
              <YardMapControls
                drawing={drawing}
                onAddPoint={(point) => setDraftPositions((positions) => [...positions, point])}
              />
              <FitYardOnMap positions={selectedYard?.positions || []} />

              {yards.map((yard) => (
                <Polygon
                  key={yard.id}
                  positions={yard.positions}
                  pathOptions={{
                    color: String(yard.id) === selectedId ? '#16a34a' : '#facc15',
                    weight: String(yard.id) === selectedId ? 3 : 2,
                    fillOpacity: 0,
                    dashArray: '10 8',
                    lineCap: 'butt',
                  }}
                >
                  <Tooltip>{yard.name}</Tooltip>
                </Polygon>
              ))}

              {drawing && draftPositions.length > 0 && (
                <>
                  {draftPositions.length > 2 ? (
                    <Polygon
                      positions={draftPositions}
                      pathOptions={{
                        color: '#f97316',
                        weight: 3,
                        fillOpacity: 0,
                        dashArray: '10 8',
                        lineCap: 'butt',
                      }}
                    />
                  ) : (
                    <Polyline positions={draftPositions} pathOptions={{ color: '#f97316', weight: 3 }} />
                  )}
                  {draftPositions.map((point, index) => (
                    <CircleMarker
                      key={`draft-${index}`}
                      center={point}
                      radius={5}
                      pathOptions={{ color: '#fff', weight: 2, fillColor: '#f97316', fillOpacity: 1 }}
                    >
                      <Tooltip>Vértice {index + 1}</Tooltip>
                    </CircleMarker>
                  ))}
                </>
              )}
            </MapContainer>
          </div>
        </div>
      </main>
    </div>
  )
}
