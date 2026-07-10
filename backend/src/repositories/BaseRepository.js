export class BaseRepository {
  constructor(model, defaultPopulate = []) {
    this.model = model;
    this.defaultPopulate = defaultPopulate;
  }

  buildQuery(filter = {}) {
    const query = {};

    for (const [key, value] of Object.entries(filter)) {
      if (value !== undefined && value !== null && value !== '') {
        query[key] = value;
      }
    }

    return query;
  }

  async findAll({ filter = {}, page = 1, limit = 50, sort = '-createdAt' } = {}) {
    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const skip = (safePage - 1) * safeLimit;
    const query = this.buildQuery(filter);

    const [items, total] = await Promise.all([
      this.model
        .find(query)
        .populate(this.defaultPopulate)
        .sort(sort)
        .skip(skip)
        .limit(safeLimit),
      this.model.countDocuments(query)
    ]);

    return {
      items,
      meta: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit)
      }
    };
  }

  async findById(id) {
    return this.model.findById(id).populate(this.defaultPopulate);
  }

  async create(data) {
    return this.model.create(data);
  }

  async updateById(id, data) {
    return this.model
      .findByIdAndUpdate(id, data, {
        new: true,
        runValidators: true
      })
      .populate(this.defaultPopulate);
  }

  async deleteById(id) {
    return this.model.findByIdAndDelete(id);
  }
}
