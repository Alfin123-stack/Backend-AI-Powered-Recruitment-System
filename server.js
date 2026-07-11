require("dotenv").config();
require("./config/env"); // validasi env wajib -- app gagal start kalau ada yang kosong

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const companyRoutes = require("./routes/companyRoutes");
const interviewRoutes = require("./routes/interviewRoutes");
const savedJobRoutes = require("./routes/savedJobRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const cvAnalysisRoutes = require("./routes/cvAnalysisRoutes");
const chatRoutes = require("./routes/chatRoutes");
const evaluationRoutes = require("./routes/evaluationRoutes");
const app = express();

// ======================
// TRUST PROXY
// ======================
// FIX (security): wajib di-set karena app ini jalan di belakang proxy
// (Vercel). Tanpa ini, express-rate-limit & req.ip bisa salah baca IP asli
// client (semua request dianggap dari 1 IP yang sama = rate limit rusak).
app.set("trust proxy", 1);

// ======================
// MIDDLEWARE GLOBAL
// ======================
app.use(helmet());

// FIX (security): CORS sebelumnya origin: "*" (izinkan domain manapun).
// Sekarang di-whitelist ke domain frontend yang memang butuh akses.
// Tambahkan domain lain lewat env FRONTEND_URLS (pisah koma) kalau perlu,
// misal untuk preview deployment Vercel.
const allowedOrigins = [
  "http://localhost:3000",
  ...(process.env.FRONTEND_URLS ? process.env.FRONTEND_URLS.split(",").map((s) => s.trim()) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // origin undefined = request tanpa header Origin (server-to-server, curl, Postman) — izinkan
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  }),
);

app.use(express.json());

// ======================
// RATE LIMIT
// ======================
// Limit umum untuk semua endpoint
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// FIX (security): limit lebih ketat khusus endpoint yang manggil Gemini AI
// (biaya per-request + rawan disalahgunakan untuk membakar kuota API).
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Terlalu banyak request AI, coba lagi sebentar lagi." },
});
app.use("/api/ai", aiLimiter);
app.use("/api/chat", aiLimiter);
app.use("/api/cv-analysis", aiLimiter);

// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

// ======================
// ROUTES
// ======================
app.use("/api/chat", chatRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/interviews", interviewRoutes);
app.use("/api/saved-jobs", savedJobRoutes);
app.use("/api/cv-analysis", cvAnalysisRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/evaluations", evaluationRoutes);

// ======================
// 404 HANDLER
// ======================
// Route yang tidak match apapun di atas -> 404 rapi (bukan HTML default Express)
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint tidak ditemukan" });
});

// ======================
// ERROR HANDLER TERPUSAT
// ======================
// WAJIB paling akhir, setelah semua routes. 4 parameter (err, req, res, next)
// supaya Express mengenalinya sebagai error-handling middleware.
const errorHandler = require("./middleware/errorHandler");
app.use(errorHandler);

// ======================
// EXPORT UNTUK VERCEL (SERVERLESS)
// ======================
module.exports = app;

// ======================
// LOCAL DEVELOPMENT ONLY
// ======================
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log("Server running on port", PORT);
  });
}
