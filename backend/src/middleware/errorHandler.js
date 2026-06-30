import { ZodError } from 'zod';

/**
 * Global Express Error Handling Middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Log critical errors for diagnostics, but ignore normal Zod validation errors in console
  if (!(err instanceof ZodError)) {
    console.error('⚡ Express Error:', err);
  }

  // Handle Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: formattedErrors
    });
  }

  // Handle PostgreSQL Errors
  if (err.code) {
    // Unique violation (e.g. email already exists)
    if (err.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Conflict: A record with this unique identifier already exists.'
      });
    }
    // Foreign key violation (e.g. host_id or charger_id does not exist)
    if (err.code === '23503') {
      return res.status(400).json({
        success: false,
        error: 'Reference error: Provided association ID does not exist.'
      });
    }
    // Check constraint violation
    if (err.code === '23514') {
      return res.status(400).json({
        success: false,
        error: 'Constraint violation: Data does not meet table check constraints.'
      });
    }
  }

  // Handle default server errors
  const isProduction = process.env.NODE_ENV === 'production';
  return res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
    ...(isProduction ? {} : { stack: err.stack })
  });
};
