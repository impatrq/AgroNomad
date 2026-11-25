import { Router } from 'express'

import {
  getYards,
  postYard,
  putCollarAssignment,
  putYard,
  removeYard,
} from '../controllers/yardController.js'

const router = Router()
router.get('/', getYards)
router.put('/collars/assignment', putCollarAssignment)
router.post('/', postYard)
router.put('/:id', putYard)
router.delete('/:id', removeYard)

export default router