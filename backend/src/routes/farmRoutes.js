import { Router } from 'express';
import { body, query } from 'express-validator';
import { farmController } from '../controllers/FarmController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const farmStatuses = ['active', 'maintenance', 'inactive'];
const pumpStatuses = ['on', 'off'];
const pumpModes = ['auto', 'manual'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 120 }),
  query('sort').optional().isString(),
  query('owner').optional().isMongoId(),
  query('status').optional().isIn(farmStatuses),
  query('cropType').optional().trim().isLength({ max: 200 }),
  validateRequest
];

const farmFields = (required) => [
  (required ? body('name').notEmpty().trim().isLength({ max: 120 }) : body('name').optional().trim().isLength({ max: 120 }))
    .withMessage('name is required and must be at most 120 characters'),
  (required ? body('code').notEmpty().trim().isLength({ max: 40 }) : body('code').optional().trim().isLength({ max: 40 }))
    .withMessage('code is required and must be at most 40 characters'),
  (required ? body('owner').notEmpty().isMongoId() : body('owner').optional().isMongoId())
    .withMessage('owner must be a valid MongoDB ObjectId'),
  body('cropType').optional().trim().isLength({ max: 200 }),
  body('status').optional().isIn(farmStatuses),
  body('location.address').optional().trim(),
  body('location.city').optional().trim(),
  body('location.country').optional().trim(),
  body('location.geo.type').optional().equals('Point'),
  body('location.geo.coordinates').optional().isArray({ min: 2, max: 2 }),
  body('location.geo.coordinates.*').optional().isFloat(),
  body('thresholds.humidityMin').optional().isFloat({ min: 0, max: 100 }),
  body('thresholds.pumpRunMinutes').optional().isInt({ min: 1, max: 240 }),
  body('thresholds.temperatureMin').optional().isFloat(),
  body('thresholds.temperatureMax').optional().isFloat(),
  body('thresholds.soilPhMin').optional().isFloat({ min: 0, max: 14 }),
  body('thresholds.soilPhMax').optional().isFloat({ min: 0, max: 14 }),
  body('pump.status').optional().isIn(pumpStatuses),
  body('pump.mode').optional().isIn(pumpModes),
  body('pump.startedAt').optional({ nullable: true }).isISO8601(),
  body('pump.scheduledStopAt').optional({ nullable: true }).isISO8601(),
  body('pump.lastChangedAt').optional({ nullable: true }).isISO8601(),
  validateRequest
];

router.route('/').get(listValidation, farmController.getAll).post(farmFields(true), farmController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, farmController.getById)
  .put(validateObjectId, ...farmFields(false), farmController.update)
  .patch(validateObjectId, ...farmFields(false), farmController.update)
  .delete(validateObjectId, validateRequest, farmController.delete);

export default router;
