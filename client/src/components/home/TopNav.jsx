export default function TopNav({ menuOpen, onToggleMenu, onNavigate, scrollToSection }) {
  return (
    <header className="sticky top-0 z-60 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <img src="/logo.jpeg" alt="Logo" className="h-12 w-12 rounded-full object-cover" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Agro<span className="text-emerald-600">Nomad</span>
            </h1>
            <p className="text-sm text-slate-500">Seguimiento de ganado con datos GPS.</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleMenu}
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
            aria-expanded={menuOpen}
          >
            {menuOpen ? 'Cerrar' : 'Menú'}
          </button>
        </div>
      </div>

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
  )
}
