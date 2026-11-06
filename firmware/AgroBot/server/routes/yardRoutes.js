import { Router } from 'express'

import { getYards, postYard, putYard } from '../controllers/yardController.js'

const router = Router()
router.get('/', getYards)
router.post('/', postYard)
router.put('/:id', putYard)

export default router