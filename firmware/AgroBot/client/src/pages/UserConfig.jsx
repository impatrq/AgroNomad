import { useEffect, useState } from 'react'
import { Pencil, Save, X } from 'lucide-react'
import HeaderMain from '../components/HeaderMain'
import { getAnimalsWsUrl } from '../lib/api'

const PROFILE_STORAGE_KEY = 'agrobot:user-profile'
const COLLAR_ACTIVE_WINDOW_MS = 15_000

const emptyProfile = {
  name: '',
  fieldName: '',
  location: '',
  animalCount: 0,
  manager: '',
  phone: '',
  hectares: 0,
}

function readProfile() {
  try {
    const storedProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    return storedProfile ? { ...emptyProfile, ...JSON.parse(storedProfile) } : emptyProfile
  } catch {
    return emptyProfile
  }
}

function formatSyncTime(timestamp) {
  if (!timestamp) return 'Sin datos'

  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return 'Sin datos'

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function displayValue(value) {
  return value === '' || value === null || typeof value === 'undefined' ? 'Sin configurar' : value
}

export default function UserConfig({ onNavigate }) {
  const [userProfile, setUserProfile] = useState(readProfile)
  const [draftProfile, setDraftProfile] = useState(userProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [animals, setAnimals] = useState([])
  const [now, setNow] = useState(0)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let isMounted = true
    let socket
    let reconnectTimeout

    const connect = () => {
      if (!isMounted) return

      socket = new WebSocket(getAnimalsWsUrl())
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          const nextAnimals = Array.isArray(message)
            ? message
            : [message?.data, message?.animals].find(Array.isArray) ?? null

          if (isMounted && nextAnimals) setAnimals(nextAnimals)
        } catch (error) {
          console.error('No se pudo leer la sincronización de collares:', error)
        }
      }
      socket.onclose = () => {
        if (isMounted) reconnectTimeout = window.setTimeout(connect, 2000)
      }
      socket.onerror = () => socket.close()
    }

    connect()
    const clockInterval = window.setInterval(() => setNow(Date.now()), 1000)

    return () => {
      isMounted = false
      window.clearTimeout(reconnectTimeout)
      window.clearInterval(clockInterval)
      socket?.close()
    }
  }, [])

  const collarAnimals = animals.filter((animal) => animal.hasCollar)
  const latestSyncAt = collarAnimals.reduce((latest, animal) => {
    const timestamp = new Date(animal.lastSeenAt).getTime()
    return Number.isFinite(timestamp) && timestamp > latest ? timestamp : latest
  }, 0)
  const activeAnimals = collarAnimals.filter((animal) => {
    const lastSeenAt = new Date(animal.lastSeenAt).getTime()
    return Number.isFinite(lastSeenAt) && now - lastSeenAt <= COLLAR_ACTIVE_WINDOW_MS
  }).length

  const startEditing = () => {
    setDraftProfile(userProfile)
    setSaveError('')
    setIsEditing(true)
  }

  const cancelEditing = () => {
    setDraftProfile(userProfile)
    setSaveError('')
    setIsEditing(false)
  }

  const saveProfile = (event) => {
    event.preventDefault()

    try {
      const updatedProfile = {
        ...draftProfile,
        name: draftProfile.name.trim(),
        fieldName: draftProfile.fieldName.trim(),
        location: draftProfile.location.trim(),
        manager: draftProfile.manager.trim(),
        phone: draftProfile.phone.trim(),
        animalCount: Math.max(0, Number(draftProfile.animalCount) || 0),
        hectares: Math.max(0, Number(draftProfile.hectares) || 0),
      }
      window.localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(updatedProfile))
      setUserProfile(updatedProfile)
      setIsEditing(false)
      setSaveError('')
    } catch {
      setSaveError('No se pudo guardar el perfil en este navegador.')
    }
  }

  const updateDraft = (event) => {
    const { name, value } = event.target
    setDraftProfile((currentProfile) => ({ ...currentProfile, [name]: value }))
  }

  const profileFields = [
    { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'name', placeholder: 'Martín Gómez' },
    { name: 'fieldName', label: 'Nombre del campo', type: 'text', placeholder: 'Finca Los Álamos' },
    { name: 'location', label: 'Ubicación', type: 'text', autoComplete: 'address-level2', placeholder: 'Chascomus, Buenos Aires' },
    { name: 'manager', label: 'Nombre del encargado', type: 'text', placeholder: 'Sofía Pérez' },
    { name: 'phone', label: 'Número de teléfono', type: 'tel', autoComplete: 'tel', placeholder: '+54 9 11 2345-6789' },
    { name: 'hectares', label: 'Hectáreas', type: 'number', min: '0', step: 'any', placeholder: '85' },
    { name: 'animalCount', label: 'Cantidad total de animales', type: 'number', min: '0', step: '1', placeholder: '42' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <HeaderMain subtitle="Resumen general del predio." onNavigate={onNavigate} />

      <main className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <section className="rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">Perfil</p>
                <h2 className="mt-2 text-3xl font-semibold">{displayValue(userProfile.name)}</h2>
                <p className="mt-2 text-slate-600">Información del usuario y del campo.</p>
              </div>
              {!isEditing && (
                <button
                  type="button"
                  onClick={startEditing}
                  className="inline-flex items-center justify-center gap-2 self-start rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 md:self-auto"
                >
                  <Pencil size={16} aria-hidden="true" />
                  Editar perfil
                </button>
              )}
            </div>
          </section>

          {isEditing && (
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Editar información</h3>
              <form onSubmit={saveProfile} className="mt-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {profileFields.map(({ label, ...field }) => (
                    <label key={field.name} className="text-sm font-medium text-slate-700">
                      {label}
                      <input
                        {...field}
                        value={draftProfile[field.name]}
                        onChange={updateDraft}
                        className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/20"
                      />
                    </label>
                  ))}
                </div>
                {saveError && <p role="alert" className="mt-4 text-sm text-red-700">{saveError}</p>}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
                  >
                    <Save size={16} aria-hidden="true" />
                    Guardar cambios
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <X size={16} aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              </form>
            </section>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-wider text-slate-500">Predio</p>
              <p className="mt-2 text-xl font-semibold">{displayValue(userProfile.fieldName)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-wider text-slate-500">Ubicación</p>
              <p className="mt-2 text-xl font-semibold">{displayValue(userProfile.location)}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-wider text-slate-500">Animales</p>
              <p className="mt-2 text-xl font-semibold">{userProfile.animalCount} totales</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm uppercase tracking-wider text-slate-500">Alertas</p>
              <p className="mt-2 text-xl font-semibold">0 pendientes</p>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Información del usuario</h3>
              <dl className="mt-5 space-y-4">
                <div className="rounded-xl bg-slate-100 p-4">
                  <dt className="text-sm uppercase text-slate-500">Nombre</dt>
                  <dd className="mt-1 text-lg font-semibold">{displayValue(userProfile.name)}</dd>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <dt className="text-sm uppercase text-slate-500">Encargado</dt>
                  <dd className="mt-1 text-lg font-semibold">{displayValue(userProfile.manager)}</dd>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <dt className="text-sm uppercase text-slate-500">Teléfono</dt>
                  <dd className="mt-1 text-lg font-semibold">{displayValue(userProfile.phone)}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-semibold">Detalles del predio</h3>
              <dl className="mt-5 space-y-4">
                <div className="rounded-xl bg-emerald-50 p-4">
                  <dt className="text-sm uppercase text-emerald-800">Collares activos</dt>
                  <dd className="mt-1 text-2xl font-semibold text-emerald-900">{activeAnimals}</dd>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <dt className="text-sm uppercase text-slate-500">Superficie</dt>
                  <dd className="mt-1 text-lg font-semibold">{userProfile.hectares} hectáreas</dd>
                </div>
                <div className="rounded-xl bg-slate-100 p-4">
                  <dt className="text-sm uppercase text-slate-500">Última sincronización de collares</dt>
                  <dd className="mt-1 text-lg font-semibold">{formatSyncTime(latestSyncAt)}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}