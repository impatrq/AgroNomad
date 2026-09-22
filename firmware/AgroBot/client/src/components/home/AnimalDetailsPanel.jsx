export default function AnimalDetailsPanel({ selectedAnimal, onNavigate, onRenameRequest }) {
  const handleCopyCoordinates = async () => {
    if (!selectedAnimal) {
      return
    }

    const formattedCoordinates = `Latitud: ${selectedAnimal.lat.toFixed(5)}, Longitud: ${selectedAnimal.lng.toFixed(5)}`

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(formattedCoordinates)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = formattedCoordinates
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }

      alert('Coordenadas copiadas al portapapeles')
    } catch (error) {
      console.error('Failed to copy coordinates:', error)
      alert('No se pudo copiar la ubicación.')
    }
  }

  return (
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
                <p className="text-sm text-slate-500">Nombre</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="mt-1 text-lg font-semibold">{selectedAnimal.name}</p>
                  <button
                    type="button"
                    onClick={onRenameRequest}
                    className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Editar
                  </button>
                </div>
              </div>

              <div className="rounded-3xl bg-slate-100 p-4">
                <p className="text-sm text-slate-500">Posicion</p>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="mt-1 text-sm font-mono mb-2">Buenos Aires, Argentina</p>
                    <p className="mt-1 text-sm font-mono">Latitud: {selectedAnimal.lat.toFixed(5)}</p>
                    <p className="mt-1 text-sm font-mono">Longitud: {selectedAnimal.lng.toFixed(5)}</p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCoordinates}
                    className="mt-2 rounded-full bg-emerald-600 px-3 py-1 text-sm font-medium text-white transition hover:bg-emerald-700"
                  >
                    Copiar
                  </button>
                </div>

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
  )
}
