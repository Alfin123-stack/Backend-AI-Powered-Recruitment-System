const validate = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      error: "Input tidak valid",
      details: result.error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  // Hanya field yang lolos skema yang diteruskan ke controller.
  // Kombinasi dengan .strict() di skema Zod menutup celah mass assignment.
  req.body = result.data;
  next();
};

module.exports = validate;
