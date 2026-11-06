import { Router } from 'express'

import { getAnimalHistory, getAnimals, renameAnimalController } from '../controllers/animalController.js'

const router = Router()
router.get('/', getAnimals)
router.get('/:id/history', getAnimalHistory)
router.post('/rename', renameAnimalController)

export default router