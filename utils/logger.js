const pino = require("pino");

// Development: pretty-print ke console. Production (Vercel): JSON polos
// supaya bisa diparse/di-query oleh log aggregator.
const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV === "production"
      ? undefined
      : { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } },
});

module.exports = logger;
