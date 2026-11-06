import { createYard, deleteYard, listYards, updateYardBoundary } from '../db/index.js'

export async function getYards(_request, response) {
  response.json(await listYards())
}

function validateYardInput(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const positions = body?.positions

  if (!name || name.length > 100) {
    return { error: 'El nombre del yard es obligatorio y debe tener hasta 100 caracteres.' }
  }
  if (!Array.isArray(positions) || positions.length < 3 || positions.length > 500) {
    return { error: 'El límite debe tener entre 3 y 500 coordenadas.' }
  }

  const normalizedPositions = []
  for (const position of positions) {
    if (
      !Array.isArray(position) ||
      position.length !== 2 ||
      !Number.isFinite(position[0]) ||
      !Number.isFinite(position[1]) ||
      position[0] < -90 ||
      position[0] > 90 ||
      position[1] < -180 ||
      position[1] > 180
    ) {
      return { error: 'Cada coordenada debe contener latitud y longitud válidas.' }
    }
    const previousPosition = normalizedPositions.at(-1)
    if (!previousPosition || previousPosition[0] !== position[0] || previousPosition[1] !== position[1]) {
      normalizedPositions.push([position[0], position[1]])
    }
  }

  const firstPosition = normalizedPositions[0]
  const lastPosition = normalizedPositions.at(-1)
  if (
    normalizedPositions.length > 1 &&
    firstPosition[0] === lastPosition[0] &&
    firstPosition[1] === lastPosition[1]
  ) {
    normalizedPositions.pop()
  }

  if (new Set(normalizedPositions.map((position) => position.join(','))).size < 3) {
    return { error: 'El límite debe contener al menos 3 puntos distintos.' }
  }

  return { name, positions: normalizedPositions }
}

function sendInvalidBoundary(response, reason) {
  return response.status(400).json({
    status: 'error',
    message: `El polígono no es válido: ${reason}.`,
  })
}

export async function postYard(request, response) {
  const input = validateYardInput(request.body)
  if (input.error) {
    return response.status(400).json({ status: 'error', message: input.error })
  }

  const result = await createYard(input.name, input.positions)
  if (result.invalidReason) {
    return sendInvalidBoundary(response, result.invalidReason)
  }
  return response.status(201).json({ status: 'ok', yard: result.yard })
}

export async function putYard(request, response) {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return response.status(400).json({ status: 'error', message: 'ID de yard inválido.' })
  }

  const input = validateYardInput(request.body)
  if (input.error) {
    return response.status(400).json({ status: 'error', message: input.error })
  }

  const result = await updateYardBoundary(id, input.name, input.positions)
  if (!result) {
    return response.status(404).json({ status: 'error', message: 'No se encontró el yard.' })
  }
  if (result.invalidReason) {
    return sendInvalidBoundary(response, result.invalidReason)
  }
  return response.json({ status: 'ok', yard: result.yard })
}

export async function removeYard(request, response) {
  const id = Number(request.params.id)
  if (!Number.isSafeInteger(id) || id < 1) {
    return response.status(400).json({ status: 'error', message: 'ID de yard inválido.' })
  }

  const deleted = await deleteYard(id)
  if (!deleted) {
    return response.status(404).json({ status: 'error', message: 'No se encontró el yard.' })
  }
  return response.json({ status: 'ok', id })
}