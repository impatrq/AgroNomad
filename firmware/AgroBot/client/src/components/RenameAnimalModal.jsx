import { useEffect, useState } from 'react'

export default function RenameAnimalModal({ animal, isOpen, onClose, onConfirm }) {
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && animal) {
      setName(animal.name || '')
      setError('')
      setSubmitting(false)
    }
  }, [animal, isOpen])

  if (!isOpen || !animal) {
    return null
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre no puede estar vacío.')
      return
    }

    setSubmitting(true)
    setError('')

    try {
      await onConfirm(trimmedName)
      onClose()
    } catch (err) {
      setError(err?.message || 'No se pudo actualizar el nombre.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[24px] border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Cambiar nombre del animal</h3>
            <p className="mt-1 text-sm text-slate-500">Actualiza el nombre de {animal.name || animal.id}.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-3 py-1 text-sm text-slate-600 transition hover:bg-slate-100"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-slate-700" htmlFor="animal-name-input">
            Nuevo nombre
          </label>
          <input
            id="animal-name-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm outline-none ring-0 focus:border-emerald-500"
            placeholder="Ej. Lila"
            autoFocus
          />

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            >
              {submitting ? 'Confirmando...' : 'Confirmar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
