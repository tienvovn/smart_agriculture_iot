import { Router } from 'express';
import { body, query } from 'express-validator';
import { userController } from '../controllers/UserController.js';
import { validateObjectId } from '../middlewares/validateObjectId.js';
import { validateRequest } from '../middlewares/validateRequest.js';

const router = Router();
const roles = ['admin', 'operator', 'viewer'];

const listValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  query('search').optional().trim().isLength({ min: 1, max: 160 }),
  query('sort').optional().isString(),
  query('role').optional().isIn(roles),
  query('isActive').optional().isBoolean().toBoolean(),
  validateRequest
];

const userFields = (required) => [
  (required ? body('fullName').notEmpty().trim().isLength({ max: 120 }) : body('fullName').optional().trim().isLength({ max: 120 }))
    .withMessage('fullName is required and must be at most 120 characters'),
  (required ? body('email').notEmpty().isEmail() : body('email').optional().isEmail())
    .withMessage('email must be valid')
    .normalizeEmail(),
  (required
    ? body('passwordHash').notEmpty().isString().isLength({ min: 20, max: 255 })
    : body('passwordHash').optional().isString().isLength({ min: 20, max: 255 }))
    .withMessage('passwordHash is required and must be between 20 and 255 characters'),
  body('role').optional().isIn(roles),
  body('isActive').optional().isBoolean().toBoolean(),
  body('lastLoginAt').optional({ nullable: true }).isISO8601(),
  validateRequest
];

router.route('/').get(listValidation, userController.getAll).post(userFields(true), userController.create);

router
  .route('/:id')
  .get(validateObjectId, validateRequest, userController.getById)
  .put(validateObjectId, ...userFields(false), userController.update)
  .patch(validateObjectId, ...userFields(false), userController.update)
  .delete(validateObjectId, validateRequest, userController.delete);

export default router;
