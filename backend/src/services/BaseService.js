import { AppError } from '../utils/AppError.js';

export class BaseService {
  constructor(repository, resourceName, options = {}) {
    this.repository = repository;
    this.resourceName = resourceName;
    this.searchFields = options.searchFields || [];
    this.filterFields = options.filterFields || [];
    this.sortFields = options.sortFields || ['createdAt', 'updatedAt'];
  }

  async getAll(query = {}) {
    const { page, limit, sort, search, ...requestedFilters } = query;
    const filter = Object.fromEntries(
      Object.entries(requestedFilters).filter(([key, value]) =>
        this.filterFields.includes(key) && value !== undefined && value !== null && value !== ''
      )
    );

    if (search && this.searchFields.length > 0) {
      const escapedSearch = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = this.searchFields.map((field) => ({
        [field]: { $regex: escapedSearch, $options: 'i' }
      }));
    }

    return this.repository.findAll({
      filter,
      page,
      limit,
      sort: this.sanitizeSort(sort)
    });
  }

  sanitizeSort(sort) {
    if (!sort) {
      return '-createdAt';
    }

    const fields = String(sort)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .filter((value) => this.sortFields.includes(value.replace(/^-/, '')));

    return fields.length > 0 ? fields.join(' ') : '-createdAt';
  }

  async getById(id) {
    const item = await this.repository.findById(id);

    if (!item) {
      throw new AppError(`${this.resourceName} not found`, 404);
    }

    return item;
  }

  async create(data) {
    return this.repository.create(data);
  }

  async update(id, data) {
    const item = await this.repository.updateById(id, data);

    if (!item) {
      throw new AppError(`${this.resourceName} not found`, 404);
    }

    return item;
  }

  async delete(id) {
    const item = await this.repository.deleteById(id);

    if (!item) {
      throw new AppError(`${this.resourceName} not found`, 404);
    }

    return item;
  }
}
