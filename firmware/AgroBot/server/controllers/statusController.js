import { listAnimals } from '../db/index.js'

export async function getStatus(_request, response) {
  const animals = await listAnimals()
  response.json({ status: 'ok', animals: animals.length })
}