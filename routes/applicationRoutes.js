const router = require("express").Router();
const {
  getHRApplications,
  updateApplicationStatus,
  applyJob,
  getMyApplications,
  checkApplied
} = require("../controllers/applicationController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/hr", authMiddleware, getHRApplications);
router.post("/apply", authMiddleware, applyJob); // candidate apply job
router.get("/my", authMiddleware, getMyApplications);
router.put("/:id/status", authMiddleware, updateApplicationStatus);
router.get("/check/:job_id", authMiddleware, checkApplied);

module.exports = router;
