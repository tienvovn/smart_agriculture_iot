import { Router } from 'express';
import { body, query } from 'express-validator';
import { sensorController } from '../controllers/SensorController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const sensorTypes = ['temperature', 'humidity', 'soil_ph'];
const sensorUnits = ['celsius', 'percent', 'ph'];
const sensorStatuses = ['online', 'offline', 'maintenance'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 180 }),
  query('sort').optional().isString(),
  query('farm').optional().isMongoId(),
  query('type').optional().isIn(sensorTypes),
  query('unit').optional().isIn(sensorUnits),
  query('status').optional().isIn(sensorStatuses),
  validateRequest
];

const sensorFields = (required) => [
  (required ? body('farm').notEmpty().isMongoId() : body('farm').optional().isMongoId())
    .withMessage('farm must be a valid MongoDB ObjectId'),
  (required ? body('name').notEmpty().trim().isLength({ max: 120 }) : body('name').optional().trim().isLength({ max: 120 }))
    .withMessage('name is required and must be at most 120 characters'),
  (required ? body('type').isIn(sensorTypes) : body('type').optional().isIn(sensorTypes))
    .withMessage(`type must be one of: ${sensorTypes.join(', ')}`),
  (required ? body('unit').isIn(sensorUnits) : body('unit').optional().isIn(sensorUnits))
    .withMessage(`unit must be one of: ${sensorUnits.join(', ')}`),
  (required ? body('deviceId').notEmpty().trim().isLength({ max: 80 }) : body('deviceId').optional().trim().isLength({ max: 80 }))
    .withMessage('deviceId is required and must be at most 80 characters'),
  (required ? body('mqttTopic').notEmpty().trim().isLength({ max: 180 }) : body('mqttTopic').optional().trim().isLength({ max: 180 }))
    .withMessage('mqttTopic is required and must be at most 180 characters'),
  body('status').optional().isIn(sensorStatuses),
  body('lastValue').optional({ nullable: true }).isFloat(),
  body('lastReadingAt').optional({ nullable: true }).isISO8601(),
  body('calibrationOffset').optional().isFloat(),
  validateRequest
];

router.route('/').get(listValidation, sensorController.getAll).post(sensorFields(true), sensorController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, sensorController.getById)
  .put(validateObjectId, ...sensorFields(false), sensorController.update)
  .patch(validateObjectId, ...sensorFields(false), sensorController.update)
  .delete(validateObjectId, validateRequest, sensorController.delete);

export default router;
