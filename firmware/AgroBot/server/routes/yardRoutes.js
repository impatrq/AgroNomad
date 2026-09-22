import { Router } from 'express'

import { getYards } from '../controllers/yardController.js'

const router = Router()
router.get('/', getYards)

export default router