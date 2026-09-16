import { listYards } from '../db/index.js'

export async function getYards(_request, response) {
  response.json({ limitsField: await listYards() })
}