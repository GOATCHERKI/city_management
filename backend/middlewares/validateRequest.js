export const validateRequest = ({ bodySchema, querySchema, paramsSchema }) => {
  return (req, res, next) => {
    req.validated = req.validated || {};

    if (bodySchema) {
      const parsedBody = bodySchema.safeParse(req.body || {});
      if (!parsedBody.success) {
        return res.status(400).json({
          message: "Invalid request body.",
          errors: parsedBody.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      req.body = parsedBody.data;
      req.validated.body = parsedBody.data;
    }

    if (querySchema) {
      const parsedQuery = querySchema.safeParse(req.query || {});
      if (!parsedQuery.success) {
        return res.status(400).json({
          message: "Invalid query parameters.",
          errors: parsedQuery.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      req.validated.query = parsedQuery.data;
    }

    if (paramsSchema) {
      const parsedParams = paramsSchema.safeParse(req.params || {});
      if (!parsedParams.success) {
        return res.status(400).json({
          message: "Invalid route parameters.",
          errors: parsedParams.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
      }
      req.validated.params = parsedParams.data;
    }

    next();
  };
};
