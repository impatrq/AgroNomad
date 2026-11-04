export function hasValidAnimalPosition(animal) {
  return Number.isFinite(animal?.lat) && Number.isFinite(animal?.lng) &&
    animal.lat !== 0 && animal.lng !== 0
}

const SAME_POSITION_EPSILON = 1e-7

export function isSameAnimalPosition(positionA, positionB, epsilon = SAME_POSITION_EPSILON) {
  if (!positionA || !positionB) return false

  const latDifference = Math.abs(Number(positionA.lat) - Number(positionB.lat))
  const lngDifference = Math.abs(Number(positionA.lng) - Number(positionB.lng))

  return Number.isFinite(latDifference) && Number.isFinite(lngDifference) &&
    latDifference <= epsilon && lngDifference <= epsilon
}

export function normalizeBoundaryGroups(payload) {
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