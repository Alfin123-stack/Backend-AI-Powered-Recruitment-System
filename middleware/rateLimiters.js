const rateLimit = require("express-rate-limit");
const logger = require("../utils/logger");

// FIX (reliability/security): express-rate-limit default nyimpen counter DI
// MEMORI PROSES. Di Vercel (serverless), tiap invocation bisa jalan di
// container/instance berbeda -- counter di-reset tiap kali, jadi limiter
// TIDAK benar-benar konsisten membatasi apapun di production.
//
// Solusinya pakai store terpusat (Redis). Upstash dipilih karena
// serverless-friendly (REST-based, cocok dipasangkan dengan Vercel).
//
// FALLBACK: kalau env Upstash belum di-set (misal saat dev di lokal tanpa
// akun Upstash), otomatis jatuh ke in-memory limiter biasa supaya app tetap
// bisa jalan -- tapi WARNING di-log supaya tidak lupa di-setup untuk production.

let aiLimiter;

// Dukung 2 sumber penamaan env:
// 1. UPSTASH_REDIS_REST_URL/TOKEN -- kalau bikin database manual di upstash.com
// 2. KV_REST_API_URL/KV_REST_API_TOKEN -- kalau connect lewat Vercel
//    Marketplace (Storage tab di Vercel dashboard), ini nama default yang
//    dikasih Vercel begitu integrasi Upstash di-attach ke project.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const hasUpstashConfig = REDIS_URL && REDIS_TOKEN;

if (hasUpstashConfig) {
  const { Ratelimit } = require("@upstash/ratelimit");
  const { Redis } = require("@upstash/redis");

  const redis = new Redis({
    url: REDIS_URL,
    token: REDIS_TOKEN,
  });

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(10, "60 s"),
    prefix: "recruitai:ai-limit",
  });

  aiLimiter = async (req, res, next) => {
    try {
      // Key per-user kalau sudah login (lebih adil), fallback ke IP kalau belum.
      const key = req.user?.id || req.ip;
      const { success, remaining, reset } = await limiter.limit(key);

      res.setHeader("X-RateLimit-Remaining", remaining);

      if (!success) {
        return res.status(429).json({
          error: "Terlalu banyak request AI, coba lagi sebentar lagi.",
          retryAt: new Date(reset).toISOString(),
        });
      }
      next();
    } catch (err) {
      // Kalau Upstash down/error, jangan block seluruh fitur AI -- log dan lanjut.
      logger.error({ err }, "Upstash rate limit error, request diteruskan tanpa limit");
      next();
    }
  };

  logger.info("Rate limiter AI: pakai Upstash Redis (serverless-safe)");
} else {
  logger.warn(
    "UPSTASH_REDIS_REST_URL/TOKEN belum di-set -- rate limiter AI pakai in-memory " +
      "(TIDAK reliable di serverless/multi-instance). Setup Upstash sebelum production.",
  );

  aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Terlalu banyak request AI, coba lagi sebentar lagi." },
  });
}

module.exports = { aiLimiter };