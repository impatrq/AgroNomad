import { listAnimals, renameAnimal } from '../db/index.js'

export async function getAnimals(_request, response) {
  response.json({ animals: await listAnimals() })
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