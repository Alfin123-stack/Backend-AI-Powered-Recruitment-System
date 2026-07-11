// Custom error classes -- controller/service bisa `throw new NotFoundError(...)`
// dkk, lalu errorHandler.js akan otomatis pakai statusCode & message yang
// AMAN untuk dikirim ke client (bukan `err.message` mentah dari Supabase/Postgres).

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // error yang "terduga" (business logic), aman ditampilkan ke user
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = "Data tidak ditemukan") {
    super(message, 404);
  }
}

class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

class ValidationError extends AppError {
  constructor(message = "Input tidak valid") {
    super(message, 400);
  }
}

class ConflictError extends AppError {
  constructor(message = "Data sudah ada / konflik") {
    super(message, 409);
  }
}

module.exports = { AppError, NotFoundError, ForbiddenError, ValidationError, ConflictError };
