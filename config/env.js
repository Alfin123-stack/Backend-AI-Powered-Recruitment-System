const { cleanEnv, str, port } = require("envalid");

// FIX (reliability/security): validasi env variable wajib saat startup.
// Kalau ada yang kosong, app langsung gagal start dengan pesan jelas --
// daripada baru error 500 samar-samar saat endpoint tertentu dipanggil
// (kasus lama: OFFER_TOKEN_SECRET kosong baru ketahuan saat kandidat
// klik link accept/decline offer).
const env = cleanEnv(process.env, {
  SUPABASE_URL: str(),
  SUPABASE_SERVICE_ROLE_KEY: str(),
  GEMINI_KEY: str(),
  OFFER_TOKEN_SECRET: str(),
  PORT: port({ default: 3000 }),
  FRONTEND_URLS: str({ default: "" }),
  // Opsional -- kalau kosong, rate limiter AI otomatis fallback ke in-memory
  // (lihat middleware/rateLimiters.js). Wajib diisi sebelum production di Vercel.
  UPSTASH_REDIS_REST_URL: str({ default: "" }),
  UPSTASH_REDIS_REST_TOKEN: str({ default: "" }),
});

module.exports = env;
