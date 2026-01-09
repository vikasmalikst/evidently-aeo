import { Router } from 'express';
import { domainReadinessController } from './domain-readiness.controller';
import { authenticateToken } from '../../middleware/auth.middleware';

const router = Router();

// Protect all routes
router.use(authenticateToken);

router.post('/brands/:brandId/domain-readiness/audit', domainReadinessController.runAudit);
router.post('/brands/:brandId/domain-readiness/audit/stream', domainReadinessController.runAuditStream);
router.get('/brands/:brandId/domain-readiness/audit', domainReadinessController.getLatestAudit);

export default router;
