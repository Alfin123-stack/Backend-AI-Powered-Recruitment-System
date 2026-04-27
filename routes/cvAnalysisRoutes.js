const router = require("express").Router();
const {
  getLatestAnalysis,
  saveAnalysis,
} = require("../controllers/cvAnalysisController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/latest", authMiddleware, getLatestAnalysis); // ambil analisis terakhir
router.post("/", authMiddleware, saveAnalysis); // simpan hasil analisis baru

module.exports = router;
