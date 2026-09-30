export default function Header({ onNavigate }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="AgroNomad" className="h-12 w-12 rounded-full object-cover" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agro<span className="text-emerald-600">Nomad</span></h1>
            <p className="text-sm text-slate-500">Historial y seguimiento del ganado.</p>
          </div>
        </div>
        <button type="button" onClick={() => onNavigate('/')} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100">Volver al mapa</button>
      </div>
    </header>
  )
}
