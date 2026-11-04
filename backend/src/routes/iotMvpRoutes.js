import { Router } from 'express';
import { body, param } from 'express-validator';
import { iotMvpController } from '../controllers/IotMvpController.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const farmCodeValidation = [body('farmCode').optional().isString().trim().isLength({ min: 1, max: 40 }), validateRequest];

router.get('/snapshot', iotMvpController.snapshot);
router.get('/telemetry/trend', iotMvpController.telemetryTrend);
router.get('/telemetry/storage', iotMvpController.telemetryStorage);
router.get('/stream', iotMvpController.stream);
router.post('/simulation/ack-timeout', ...farmCodeValidation, iotMvpController.startAckTimeout);
router.post('/simulation/silent-failure', ...farmCodeValidation, iotMvpController.startSilentFailure);
router.post('/simulation/restore-controller', ...farmCodeValidation, iotMvpController.restoreController);
router.post('/simulation/reset', ...farmCodeValidation, iotMvpController.resetScenario);
router.post(
  '/incidents/:incidentId/retry',
  param('incidentId').isString().trim().isLength({ min: 1, max: 80 }),
  validateRequest,
  iotMvpController.retryIncident
);
router.get(
  '/incidents/:incidentId/evidence',
  param('incidentId').isString().trim().isLength({ min: 1, max: 80 }),
  validateRequest,
  iotMvpController.incidentEvidence
);

export default router;
