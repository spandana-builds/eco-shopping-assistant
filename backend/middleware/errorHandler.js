// Centralized error handler
module.exports = function errorHandler(err, _req, res, _next) {
  console.error("[eco-error]", err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
};
