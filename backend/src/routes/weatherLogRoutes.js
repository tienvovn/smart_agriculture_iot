import { Router } from 'express';
import { body, query } from 'express-validator';
import { weatherLogController } from '../controllers/WeatherLogController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const conditions = ['sunny', 'cloudy', 'rainy', 'storm', 'dry', 'windy'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 80 }),
  query('sort').optional().isString(),
  query('farm').optional().isMongoId(),
  query('condition').optional().isIn(conditions),
  validateRequest
];

const weatherLogFields = (required) => [
  (required ? body('farm').notEmpty().isMongoId() : body('farm').optional().isMongoId())
    .withMessage('farm must be a valid MongoDB ObjectId'),
  (required ? body('condition').notEmpty().isIn(conditions) : body('condition').optional().isIn(conditions)),
  (required ? body('temperatureDelta').notEmpty().isFloat() : body('temperatureDelta').optional().isFloat()),
  (required ? body('humidityDelta').notEmpty().isFloat() : body('humidityDelta').optional().isFloat()),
  (required ? body('temperatureAfter').notEmpty().isFloat() : body('temperatureAfter').optional().isFloat()),
  (required
    ? body('humidityAfter').notEmpty().isFloat({ min: 0, max: 100 })
    : body('humidityAfter').optional().isFloat({ min: 0, max: 100 })),
  body('simulatedAt').optional().isISO8601(),
  validateRequest
];

router.route('/').get(listValidation, weatherLogController.getAll).post(weatherLogFields(true), weatherLogController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, weatherLogController.getById)
  .put(validateObjectId, ...weatherLogFields(false), weatherLogController.update)
  .patch(validateObjectId, ...weatherLogFields(false), weatherLogController.update)
  .delete(validateObjectId, validateRequest, weatherLogController.delete);

export default router;
