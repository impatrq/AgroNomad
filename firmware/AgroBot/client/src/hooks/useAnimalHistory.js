import { useEffect, useState } from 'react'
import { apiUrl } from '../lib/api'

const HISTORY_LIMIT = 10

export default function useAnimalHistory(animalId) {
  const [snapshot, setSnapshot] = useState({
    animalId: null,
    positions: [],
    error: null,
  })

  useEffect(() => {
    if (!animalId) return undefined

    const controller = new AbortController()

    fetch(
      apiUrl(`/api/animals/${encodeURIComponent(animalId)}/history?limit=${HISTORY_LIMIT}`),
      { signal: controller.signal }
    )
      .then((response) => {
        if (!response.ok) {
          throw new Error(`History: ${response.status} ${response.statusText}`)
        }
        return response.json()
      })
      .then((data) => {
        setSnapshot({
          animalId,
          positions: Array.isArray(data?.positions) ? data.positions : [],
          error: null,
        })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return

        console.error('Animal history load error:', error)
        setSnapshot({
          animalId,
          positions: [],
          error: error.message || 'No se pudo cargar el recorrido.',
        })
      })

    return () => controller.abort()
  }, [animalId])

  // Ignore stale data from a previously selected animal while the new request is in flight.
  const belongsToSelectedAnimal = snapshot.animalId === animalId

  return {
    positions: belongsToSelectedAnimal ? snapshot.positions : [],
    loading: Boolean(animalId) && !belongsToSelectedAnimal,
    error: belongsToSelectedAnimal ? snapshot.error : null,
  }
}
