import { Router } from 'express';
import { body, query } from 'express-validator';
import { pumpLogController } from '../controllers/PumpLogController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const actions = ['turned_on', 'turned_off'];
const triggers = ['auto_humidity_low', 'auto_duration_complete', 'manual', 'system'];
const modes = ['auto', 'manual'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 80 }),
  query('sort').optional().isString(),
  query('farm').optional().isMongoId(),
  query('requestedBy').optional().isMongoId(),
  query('action').optional().isIn(actions),
  query('trigger').optional().isIn(triggers),
  query('mode').optional().isIn(modes),
  validateRequest
];

const pumpLogFields = (required) => [
  (required ? body('farm').notEmpty().isMongoId() : body('farm').optional().isMongoId())
    .withMessage('farm must be a valid MongoDB ObjectId'),
  (required ? body('action').isIn(actions) : body('action').optional().isIn(actions)),
  (required ? body('trigger').isIn(triggers) : body('trigger').optional().isIn(triggers)),
  (required ? body('mode').isIn(modes) : body('mode').optional().isIn(modes)),
  body('humidityValue').optional({ nullable: true }).isFloat({ min: 0, max: 100 }),
  body('threshold').optional().isFloat({ min: 0, max: 100 }),
  body('runDurationMinutes').optional().isInt({ min: 1 }),
  body('startedAt').optional({ nullable: true }).isISO8601(),
  body('stoppedAt').optional({ nullable: true }).isISO8601(),
  body('occurredAt').optional().isISO8601(),
  body('requestedBy').optional({ nullable: true }).isMongoId(),
  body('relatedSensorLog').optional({ nullable: true }).isMongoId(),
  validateRequest
];

router.route('/').get(listValidation, pumpLogController.getAll).post(pumpLogFields(true), pumpLogController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, pumpLogController.getById)
  .put(validateObjectId, ...pumpLogFields(false), pumpLogController.update)
  .patch(validateObjectId, ...pumpLogFields(false), pumpLogController.update)
  .delete(validateObjectId, validateRequest, pumpLogController.delete);

export default router;
