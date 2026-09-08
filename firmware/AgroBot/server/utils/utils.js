export function normalizeAnimalPayload(raw) {
  if (!raw || typeof raw !== 'object') return null

  const id = String(raw.ID ?? raw.id ?? raw.Id ?? raw.iD ?? '').trim()
  const lat = Number(raw.LAT ?? raw.lat ?? raw.latitude ?? raw.Lat ?? raw.Latitude)
  const lng = Number(raw.LONG ?? raw.long ?? raw.longitude ?? raw.Long ?? raw.Longitude)
  const temp = raw.TEMP ?? raw.temp ?? raw.temperature ?? raw.Temperature ?? ''
  const hb = raw.HB ?? raw.hb ?? raw.HeartBeat ?? raw.hbRate ?? raw.heartBeat ?? ''

  if (!id || Number.isNaN(lat) || Number.isNaN(lng)) {
    return null
  }

  return {
    id,
    name: raw.NAME ?? raw.name ?? raw.Name ?? `Animal ${id}`,
    lat,
    lng,
    temp: String(temp),
    hb: String(hb),
  }
}



export function normalizeLimitsField(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const normalized = {}

  Object.entries(raw).forEach(([fieldName, fieldValue]) => {
    if (!fieldValue || typeof fieldValue !== 'object' || Array.isArray(fieldValue)) return

    const points = {}

    Object.entries(fieldValue).forEach(([limitName, point]) => {
      if (!point || typeof point !== 'object' || Array.isArray(point)) return

      const lat = Number(point.lat ?? point.LAT ?? point.latitude ?? point.Latitude)
      const lng = Number(point.lng ?? point.LNG ?? point.long ?? point.LONG ?? point.longitude ?? point.Longitude)

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        points[limitName] = { lat, lng }
      }
    })

    if (Object.keys(points).length > 0) {
      normalized[fieldName] = points
    }
  })

  return Object.keys(normalized).length > 0 ? normalized : null
}


export function mergeLimitsField(newLimits) {
  if (!newLimits || typeof newLimits !== 'object' || Array.isArray(newLimits)) return
  // object.entries(newLimits) ===> Converts the object into key-value pairs.
  /*
    from:

    const newLimits = {
      latitude: { min: 36, max: 40 },
      longitude: { min: 0, max: 20 }
    }

    to:

    [
      ['latitude', { min: 36, max: 40 }],
      ['longitude', { min: 0, max: 20 }]
    ]

  */

  Object.entries(newLimits).forEach(([fieldName, fieldValue]) => {
    if (fieldValue && typeof fieldValue === 'object' && !Array.isArray(fieldValue)) {
      limitsField[fieldName] = fieldValue
    }
  })
}


export function extractJsonObjects(value) {
  const jsonObjects = []
  let buffer = ''
  let depth = 0
  let inString = false
  let escape = false

  for (let i = 0; i < value.length; i += 1) {
    const char = value[i]
    buffer += char

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) {
      continue
    }

    if (char === '{') {
      depth += 1
    }
    if (char === '}') {
      depth -= 1
    }

    if (depth === 0 && buffer.trim()) {
      jsonObjects.push(buffer.trim())
      buffer = ''
    }
  }

  if (buffer.trim()) {
    jsonObjects.push(buffer.trim())
  }

  return jsonObjects
}
