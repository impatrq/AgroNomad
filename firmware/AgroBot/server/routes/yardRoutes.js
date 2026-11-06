import { Router } from 'express'

import { getYards, postYard, putYard, removeYard } from '../controllers/yardController.js'

const router = Router()
router.get('/', getYards)
router.post('/', postYard)
router.put('/:id', putYard)
router.delete('/:id', removeYard)

export default router