import { userService } from '../services/UserService.js';
import { BaseController } from './BaseController.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';

const baseController = new BaseController(userService, 'User');

function withoutPasswordHash(user) {
  const data = user.toObject ? user.toObject() : user;
  const safeUser = { ...data };
  delete safeUser.passwordHash;
  return safeUser;
}

export const userController = {
  ...baseController,
  create: asyncHandler(async (req, res) => {
    const user = await userService.create(req.body);
    return sendSuccess(res, 201, 'User created successfully', withoutPasswordHash(user));
  }),
  update: asyncHandler(async (req, res) => {
    const user = await userService.update(req.params.id, req.body);
    return sendSuccess(res, 200, 'User updated successfully', withoutPasswordHash(user));
  }),
  delete: asyncHandler(async (req, res) => {
    const user = await userService.delete(req.params.id);
    return sendSuccess(res, 200, 'User deleted successfully', withoutPasswordHash(user));
  })
};
