const router = require("express").Router();
const {
  getHRInterviews,
  getShortlistedCandidates,
  createInterview,
  updateInterview,
} = require("../controllers/interviewController");
const authMiddleware = require("../middleware/authMiddleware");

// Semua route butuh auth
router.get("/", authMiddleware, getHRInterviews); // semua interview milik HR
router.get("/shortlisted", authMiddleware, getShortlistedCandidates); // kandidat shortlisted belum dijadwalkan
router.post("/", authMiddleware, createInterview); // buat jadwal interview
router.put("/:id", authMiddleware, updateInterview); // update status/detail interview

module.exports = router;
