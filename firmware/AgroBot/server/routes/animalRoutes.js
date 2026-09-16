import { Router } from 'express'

import { getAnimals, renameAnimalController } from '../controllers/animalController.js'

const router = Router()
router.get('/', getAnimals)
router.post('/rename', renameAnimalController)

export default router