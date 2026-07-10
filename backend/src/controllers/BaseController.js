import { sendSuccess } from '../utils/apiResponse.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export class BaseController {
  constructor(service, resourceName) {
    this.service = service;
    this.resourceName = resourceName;

    this.getAll = asyncHandler(this.getAll.bind(this));
    this.getById = asyncHandler(this.getById.bind(this));
    this.create = asyncHandler(this.create.bind(this));
    this.update = asyncHandler(this.update.bind(this));
    this.delete = asyncHandler(this.delete.bind(this));
  }

  async getAll(req, res) {
    const result = await this.service.getAll(req.query);
    return sendSuccess(
      res,
      200,
      `${this.resourceName} records retrieved successfully`,
      result.items,
      result.meta
    );
  }

  async getById(req, res) {
    const item = await this.service.getById(req.params.id);
    return sendSuccess(res, 200, `${this.resourceName} retrieved successfully`, item);
  }

  async create(req, res) {
    const item = await this.service.create(req.body);
    return sendSuccess(res, 201, `${this.resourceName} created successfully`, item);
  }

  async update(req, res) {
    const item = await this.service.update(req.params.id, req.body);
    return sendSuccess(res, 200, `${this.resourceName} updated successfully`, item);
  }

  async delete(req, res) {
    const item = await this.service.delete(req.params.id);
    return sendSuccess(res, 200, `${this.resourceName} deleted successfully`, item);
  }
}
