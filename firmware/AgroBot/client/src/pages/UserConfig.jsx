export default function UserConfig({ onNavigate }) {
  const userProfile = {
    name: 'Martín Gómez',
    fieldName: 'Finca Los Álamos',
    location: 'Río Cuarto, Córdoba',
    animalCount: 42,
    activeAnimals: 38,
    alerts: 3,
    manager: 'Sofía Pérez',
    phone: '+54 9 351 234-5678',
    hectares: 85,
    lastSync: 'Hace 2 minutos',
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-60 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configuración de usuario</h1>
            <p className="text-sm text-slate-500">Resumen general del predio y del responsable</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-100"
          >
            Volver al mapa
          </button>
        </div>
      </header>

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-[28px] border border-green-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">Perfil</p>
                <h2 className="mt-2 text-3xl font-semibold">{userProfile.name}</h2>
                <p className="mt-2 text-slate-500">Responsable del seguimiento de ganado y del estado del campo.</p>
              </div>
              <div className="rounded-3xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                Última sincronización: {userProfile.lastSync}
              </div>
            </div>
          </section>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Predio</p>
              <p className="mt-2 text-xl font-semibold">{userProfile.fieldName}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Ubicación</p>
              <p className="mt-2 text-xl font-semibold">{userProfile.location}</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Animales</p>
              <p className="mt-2 text-xl font-semibold">{userProfile.animalCount} totales</p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Alertas</p>
              <p className="mt-2 text-xl font-semibold">{userProfile.alerts} pendientes</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Información del usuario</h3>
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Nombre</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.name}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Campo</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.fieldName}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Lugar del campo</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.location}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Cantidad de animales</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.animalCount}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Detalles del predio</h3>
              <div className="mt-5 space-y-4">
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-sm uppercase text-emerald-700">Animales activos</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-800">{userProfile.activeAnimals}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Superficie</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.hectares} hectáreas</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Encargado</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.manager}</p>
                </div>
                <div className="rounded-3xl bg-slate-100 p-4">
                  <p className="text-sm uppercase text-slate-500">Contacto</p>
                  <p className="mt-1 text-lg font-semibold">{userProfile.phone}</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
