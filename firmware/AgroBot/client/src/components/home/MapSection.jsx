import AnimalMap from './AnimalMap'

export default function MapSection({
  animals,
  selectedAnimal,
  onSelectAnimal,
  yardBoundaries,
  mapPosition,
  loading,
  error,
}) {
  return (
    <div id="map-section" className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
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
              <>Animal seleccionado <strong>{selectedAnimal.name}(ID:{selectedAnimal.id})</strong></>
            ) : (
              'Ningun animal seleccionado.'
            )}
          </span>

          {!loading && !error && (
            <span className="h-3 w-3 rounded-full bg-orange-500 ring-2 ring-orange-100" />
          )}
        </div>
      </div>

      <AnimalMap
        animals={animals}
        selectedAnimal={selectedAnimal}
        onSelectAnimal={onSelectAnimal}
        yardBoundaries={yardBoundaries}
        mapPosition={mapPosition}
      />
    </div>
  )
}
