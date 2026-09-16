import { upsertAnimalSnapshot } from '../db/index.js'

export function normalizeAnimalPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const id = String(raw.ID ?? raw.id ?? raw.Id ?? raw.iD ?? '').trim()
  const lat = Number(raw.LAT ?? raw.lat ?? raw.latitude ?? raw.Lat ?? raw.Latitude)
  const lng = Number(raw.LONG ?? raw.long ?? raw.longitude ?? raw.Long ?? raw.Longitude)
  const temp = raw.TEMP ?? raw.temp ?? raw.temperature ?? raw.Temperature ?? ''

  if (!id || Number.isNaN(lat) || Number.isNaN(lng)) return null

  return { id, name: raw.NAME ?? raw.name ?? raw.Name ?? `Animal ${id}`, lat, lng, temp: String(temp) }
}

export function extractJsonPayloads(buffer) {
  const payloads = []
  let start = -1
  let depth = 0
  let inString = false
  let escaped = false

  for (let index = 0; index < buffer.length; index += 1) {
    const char = buffer[index]
    if (start === -1) {
      if (char === '{' || char === '[') {
        start = index
        depth = 1
      }
      continue
    }
    if (escaped) {
      escaped = false
      continue
    }
    if (char === '\\' && inString) {
      escaped = true
      continue
    }
    if (char === '"') {
      inString = !inString
      continue
    }
    if (inString) continue
    if (char === '{' || char === '[') depth += 1
    if (char === '}' || char === ']') depth -= 1

    if (depth === 0) {
      payloads.push(buffer.slice(start, index + 1))
      start = -1
    }
  }

  return { payloads, remainder: start === -1 ? '' : buffer.slice(start) }
}

export async function processTelemetryPayload(payload) {
  const parsed = JSON.parse(payload)
  const items = Array.isArray(parsed) ? parsed : [parsed]

  for (const item of items) {
    if (normalizeAnimalPayload(item)) await upsertAnimalSnapshot(item)
  }
}