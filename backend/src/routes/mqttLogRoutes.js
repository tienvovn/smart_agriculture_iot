import { Router } from 'express';
import { body, query } from 'express-validator';
import { mqttLogController } from '../controllers/MQTTLogController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const directions = ['incoming', 'outgoing'];
const messageTypes = ['sensor_reading', 'pump_command', 'device_status', 'unknown'];
const processingStatuses = ['pending', 'processed', 'failed'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 180 }),
  query('sort').optional().isString(),
  query('farm').optional().isMongoId(),
  query('sensor').optional().isMongoId(),
  query('direction').optional().isIn(directions),
  query('messageType').optional().isIn(messageTypes),
  query('qos').optional().isInt({ min: 0, max: 2 }).toInt(),
  query('retained').optional().isBoolean().toBoolean(),
  query('processingStatus').optional().isIn(processingStatuses),
  validateRequest
];

const mqttLogFields = (required) => [
  body('farm').optional({ nullable: true }).isMongoId(),
  body('sensor').optional({ nullable: true }).isMongoId(),
  (required ? body('topic').notEmpty().trim().isLength({ max: 180 }) : body('topic').optional().trim().isLength({ max: 180 })),
  (required ? body('direction').notEmpty().isIn(directions) : body('direction').optional().isIn(directions)),
  body('messageType').optional().isIn(messageTypes),
  required
    ? body('payload').exists({ values: 'null' }).withMessage('payload is required')
    : body('payload').optional(),
  body('qos').optional().isInt({ min: 0, max: 2 }).toInt(),
  body('retained').optional().isBoolean().toBoolean(),
  body('receivedAt').optional().isISO8601(),
  body('processedAt').optional({ nullable: true }).isISO8601(),
  body('processingStatus').optional().isIn(processingStatuses),
  body('errorMessage').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest
];

router.route('/').get(listValidation, mqttLogController.getAll).post(mqttLogFields(true), mqttLogController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, mqttLogController.getById)
  .put(validateObjectId, ...mqttLogFields(false), mqttLogController.update)
  .patch(validateObjectId, ...mqttLogFields(false), mqttLogController.update)
  .delete(validateObjectId, validateRequest, mqttLogController.delete);

export default router;
