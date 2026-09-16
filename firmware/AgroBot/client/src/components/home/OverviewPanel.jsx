export default function OverviewPanel({ animals, loading, error }) {
  return (
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
  )
}
