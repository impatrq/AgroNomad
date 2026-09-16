import { useEffect, useRef, useState } from 'react'

function normalizeBoundaryGroups(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return []
  }

  const rawGroups = payload.limitsField || payload.limits || payload.boundaries || payload.boundaryFields || payload.fields

  if (!rawGroups || typeof rawGroups !== 'object' || Array.isArray(rawGroups)) {
    return []
  }

  return Object.entries(rawGroups)
    .map(([name, points]) => {
      if (!points || typeof points !== 'object' || Array.isArray(points)) {
        return null
      }

      const positions = Object.values(points)
        .map((point) => {
          if (!point || typeof point !== 'object' || Array.isArray(point)) {
            return null
          }

          const lat = Number(point.lat ?? point.LAT ?? point.latitude ?? point.Latitude)
          const lng = Number(point.lng ?? point.LNG ?? point.long ?? point.LONG ?? point.longitude ?? point.Longitude)

          if (Number.isNaN(lat) || Number.isNaN(lng)) {
            return null
          }

          return [lat, lng]
        })
        .filter(Boolean)

      if (positions.length < 2) {
        return null
      }

      const closedPositions = positions[0].toString() !== positions[positions.length - 1].toString()
        ? [...positions, positions[0]]
        : positions

      return { name, positions: closedPositions }
    })
    .filter(Boolean)
}

export default function useAnimalDashboard() {
  const [animals, setAnimals] = useState([])
  const [yardBoundaries, setYardBoundaries] = useState([])
  const [selectedAnimal, setSelectedAnimal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const selectedAnimalRef = useRef(null)

  useEffect(() => {
    selectedAnimalRef.current = selectedAnimal
  }, [selectedAnimal])

  useEffect(() => {
    let isMounted = true

    async function loadAnimalData() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/animals')
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`)
        }

        const data = await response.json()
        const rawAnimals = Array.isArray(data)
          ? data
          : Array.isArray(data?.animals)
            ? data.animals
            : []

        if (!Array.isArray(rawAnimals)) {
          throw new Error('Invalid data format')
        }

        const normalized = rawAnimals.map((item) => ({
          id: String(item.ID || item.id || ''),
          name: item.NAME || item.name || `Animal ${item.ID || item.id}`,
          lat: Number(item.LAT || item.lat || 0),
          lng: Number(item.LONG || item.long || item.lng || 0),
          temp: String(item.TEMP || item.temp || ''),
        }))

        if (!isMounted) {
          return
        }

        const previouslySelectedId = selectedAnimalRef.current?.id

        setAnimals(normalized)
        setYardBoundaries(normalizeBoundaryGroups(data))

        if (normalized.length > 0) {
          const stillSelected = normalized.find((animal) => animal.id === previouslySelectedId)
          setSelectedAnimal(stillSelected || normalized[0])
        } else {
          setSelectedAnimal(null)
        }

        setLoading(false)
      } catch (err) {
        if (!isMounted) {
          return
        }

        console.error('Load error:', err)
        setError(err.message || 'No se pudo cargar los animales.')
        setLoading(false)
      }
    }

    loadAnimalData()

    const interval = setInterval(loadAnimalData, 15000)

    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  const handleRenameAnimal = async (newName) => {
    if (!selectedAnimal) {
      throw new Error('No hay un animal seleccionado.')
    }

    const response = await fetch('/api/animals/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedAnimal.id, name: newName }),
    })

    if (!response.ok) {
      throw new Error('No se pudo actualizar el nombre en el servidor.')
    }

    const result = await response.json().catch(() => ({}))
    if (result?.status !== 'ok') {
      throw new Error('El servidor no confirmó el cambio.')
    }

    setAnimals((prevAnimals) =>
      prevAnimals.map((animal) => (animal.id === selectedAnimal.id ? { ...animal, name: newName } : animal))
    )

    setSelectedAnimal((prevSelected) =>
      prevSelected && prevSelected.id === selectedAnimal.id ? { ...prevSelected, name: newName } : prevSelected
    )
  }

  return {
    animals,
    yardBoundaries,
    selectedAnimal,
    setSelectedAnimal,
    loading,
    error,
    handleRenameAnimal,
  }
}
