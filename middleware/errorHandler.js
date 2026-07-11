const logger = require("../utils/logger");
const { AppError } = require("../utils/errors");

// Error handler TERPUSAT -- harus 4 parameter (err, req, res, next) supaya
// dikenali Express sebagai error-handling middleware, dan harus dipasang
// PALING TERAKHIR di server.js (setelah semua routes).
//
// Semua error yang di-throw / di-reject di controller (baik lewat next(err)
// eksplisit, maupun otomatis lewat Express 5 untuk async handler) berakhir
// di sini.
module.exports = (err, req, res, next) => {
  // AppError (NotFoundError, ForbiddenError, dll) = error "terduga" dari
  // business logic kita sendiri -- statusCode & message aman ditampilkan ke user.
  if (err instanceof AppError) {
    logger.warn(
      { err: err.message, statusCode: err.statusCode, path: req.path, userId: req.user?.id },
      "Handled application error",
    );
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Error tak terduga (bug, error Supabase/Postgres, dll) -- JANGAN kirim
  // err.message mentah ke client (bisa bocorkan detail internal DB/skema).
  // Log detail lengkap di server, balas client dengan pesan generik.
  logger.error(
    { err, path: req.path, method: req.method, userId: req.user?.id },
    "Unhandled error",
  );

  res.status(500).json({ error: "Terjadi kesalahan pada server" });
};
