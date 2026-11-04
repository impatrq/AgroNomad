import { listAnimalHistory, listAnimals, renameAnimal } from '../db/index.js'

export async function getAnimals(_request, response) {
  response.json({ animals: await listAnimals() })
}

export async function getAnimalHistory(request, response) {
  const animalId = String(request.params?.id ?? '').trim()

  if (!animalId) {
    response.status(400).json({ status: 'error', message: 'Missing animal id' })
    return
  }

  const requestedLimit = Number.parseInt(request.query?.limit, 10)
  const limit = Number.isNaN(requestedLimit)
    ? 10
    : Math.min(Math.max(requestedLimit, 1), 50)

  const positions = await listAnimalHistory(animalId, limit)

  if (positions === null) {
    response.status(404).json({ status: 'error', message: 'Animal not found' })
    return
  }

  response.json({ status: 'ok', positions })
}

export async function renameAnimalController(request, response) {
  const animalId = String(request.body?.id ?? '').trim()
  const name = String(request.body?.name ?? '').trim()

  if (!animalId || !name) {
    response.status(400).json({ status: 'error', message: 'Missing id or name' })
    return
  }

  const result = await renameAnimal(animalId, name)
  if (!result) {
    response.status(404).json({ status: 'error', message: 'Animal not found' })
    return
  }

  response.json({ status: 'ok', ...result })
}