import { Router } from 'express';
import * as AEOScoringController from '../controllers/aeo-scoring.controller';

const router = Router();

router.post('/score', AEOScoringController.scoreContent);

export default router;
