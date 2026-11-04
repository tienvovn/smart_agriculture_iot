export function errorHandler(error, req, res, _next) {
  let statusCode = error.statusCode || 500;
  let message = error.message || 'Internal server error';
  let details = error.details || null;

  if (error.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${error.path}: ${error.value}`;
  }

  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation failed';
    details = Object.values(error.errors).map((item) => ({
      field: item.path,
      message: item.message
    }));
  }

  if (error.code === 11000) {
    statusCode = 409;
    message = 'Duplicate resource';
    details = Object.keys(error.keyValue || {}).map((field) => ({
      field,
      message: `${field} already exists`
    }));
  }

  const response = {
    success: false,
    message
  };

  if (details) {
    response.details = details;
  }

  if (process.env.NODE_ENV !== 'production') {
    response.stack = error.stack;
  }

  return res.status(statusCode).json(response);
}
