/**
 * Validation middleware using Zod schemas
 * Supports validation for req.body, req.query, and req.params
 * Automatically converts/parses query and param inputs if transformed in schemas.
 */
export const validate = (schemas) => {
  return async (req, res, next) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }
      return next();
    } catch (error) {
      return next(error); // Pass Zod validation error to global error handler
    }
  };
};
