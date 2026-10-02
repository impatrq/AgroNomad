import { Search } from 'lucide-react'

export default function FilterBar() {
  const controlClass = 'rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
  return (
    <section className="mb-6 rounded-[28px] border border-green-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} /><input type="search" placeholder="Buscar por nombre, collar o edad..." className={`${controlClass} w-full pl-11`} /></div>
        <select className={controlClass} defaultValue="todos"><option value="todos">Todos los tipos</option><option>Vaca</option><option>Toro</option><option>Vaquillona</option></select>
        <select className={controlClass} defaultValue="todos"><option value="todos">Todos los potreros</option><option>Campo Norte</option><option>Pastura Este</option><option>Campo Sur</option></select>
        <input type="text" inputMode="numeric" placeholder="Edad mín." className={`${controlClass} w-28`} /><input type="text" inputMode="numeric" placeholder="Edad máx." className={`${controlClass} w-28`} />
        <button className="rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700">Limpiar</button>
      </div>
    </section>
  )
}
