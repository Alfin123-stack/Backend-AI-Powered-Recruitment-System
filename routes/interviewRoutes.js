const router = require("express").Router();
const {
  getHRInterviews,
  getShortlistedCandidates,
  createInterview,
  updateInterview,
  getMyInterviews,
} = require("../controllers/interviewController");

const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");

// Semua route butuh auth
router.get("/", authMiddleware, checkRole("hr"), getHRInterviews); // semua interview milik HR
router.get("/shortlisted", authMiddleware, checkRole("hr"), getShortlistedCandidates); // kandidat shortlisted belum dijadwalkan
router.post("/", authMiddleware, checkRole("hr"), createInterview); // buat jadwal interview
router.get("/my", authMiddleware, getMyInterviews); // jadwal interview kandidat (candidate)
router.put("/:id", authMiddleware, checkRole("hr"), updateInterview); // update status/detail interview

module.exports = router;
