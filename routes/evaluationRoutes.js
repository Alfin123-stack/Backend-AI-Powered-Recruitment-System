const router = require("express").Router();
const {
  createEvaluation,
  getEvaluationsByApplication,
} = require("../controllers/evaluationController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/", authMiddleware, createEvaluation); // HR simpan evaluasi
router.get("/application/:applicationId", authMiddleware, getEvaluationsByApplication); // HR & candidate lihat

module.exports = router;