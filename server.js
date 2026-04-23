require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const jobRoutes = require("./routes/jobRoutes");
const aiRoutes = require("./routes/aiRoutes");
const applicationRoutes = require("./routes/applicationRoutes");
const companyRoutes = require("./routes/companyRoutes");
const interviewRoutes = require("./routes/interviewRoutes"); // ← tambah
const savedJobRoutes = require("./routes/savedJobRoutes"); // ← tambah
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

// ======================
// MIDDLEWARE GLOBAL
// ======================
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(express.json());

// ======================
// RATE LIMIT
// ======================
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use(limiter);

// ======================
// TEST ROUTE
// ======================
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

// ======================
// ROUTES
// ======================
app.use("/api/jobs", jobRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/interviews", interviewRoutes); // ← tambah
app.use("/api/saved-jobs", savedJobRoutes); // ← tambah

app.use("/api/notifications", notificationRoutes);

// ======================
// SERVER
// ======================
app.listen(process.env.PORT, () => {
  console.log("Server running on port", process.env.PORT);
});
