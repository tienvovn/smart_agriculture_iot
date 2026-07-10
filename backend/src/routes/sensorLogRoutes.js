import { Router } from 'express';
import { body, query } from 'express-validator';
import { sensorLogController } from '../controllers/SensorLogController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const sensorTypes = ['temperature', 'humidity', 'soil_ph'];
const units = ['celsius', 'percent', 'ph'];
const sources = ['simulator', 'mqtt', 'manual'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 80 }),
  query('sort').optional().isString(),
  query('farm').optional().isMongoId(),
  query('sensor').optional().isMongoId(),
  query('sensorType').optional().isIn(sensorTypes),
  query('unit').optional().isIn(units),
  query('source').optional().isIn(sources),
  validateRequest
];

const sensorLogFields = (required) => [
  (required ? body('farm').notEmpty().isMongoId() : body('farm').optional().isMongoId())
    .withMessage('farm must be a valid MongoDB ObjectId'),
  (required ? body('sensor').notEmpty().isMongoId() : body('sensor').optional().isMongoId())
    .withMessage('sensor must be a valid MongoDB ObjectId'),
  (required ? body('sensorType').isIn(sensorTypes) : body('sensorType').optional().isIn(sensorTypes)),
  (required ? body('value').notEmpty().isFloat() : body('value').optional().isFloat())
    .withMessage('value must be numeric'),
  (required ? body('unit').isIn(units) : body('unit').optional().isIn(units)),
  body('source').optional().isIn(sources),
  body('capturedAt').optional().isISO8601(),
  body('metadata.weatherLog').optional({ nullable: true }).isMongoId(),
  body('metadata.mqttLog').optional({ nullable: true }).isMongoId(),
  validateRequest
];

router.route('/').get(listValidation, sensorLogController.getAll).post(sensorLogFields(true), sensorLogController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, sensorLogController.getById)
  .put(validateObjectId, ...sensorLogFields(false), sensorLogController.update)
  .patch(validateObjectId, ...sensorLogFields(false), sensorLogController.update)
  .delete(validateObjectId, validateRequest, sensorLogController.delete);

export default router;
