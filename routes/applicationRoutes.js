const router = require("express").Router();
const {
  getHRApplications,
  updateApplicationStatus,
  applyJob,
  getMyApplications,
  checkApplied,
  createOfferToken,
  updateOfferStatus,
  updateOnboardingSent,
} = require("../controllers/applicationController");
const authMiddleware = require("../middleware/authMiddleware");
const offerAuthMiddleware = require("../middleware/offerAuthMiddleware");

router.get("/hr", authMiddleware, getHRApplications);
router.post("/apply", authMiddleware, applyJob); // candidate apply job
router.get("/my", authMiddleware, getMyApplications);
router.put("/:id/status", authMiddleware, updateApplicationStatus);
router.get("/check/:job_id", authMiddleware, checkApplied);


router.post("/:id/offer-token", authMiddleware, createOfferToken);
router.put("/:id/offer", offerAuthMiddleware, updateOfferStatus);
// TAMBAHAN: authMiddleware biasa (bukan offerAuthMiddleware) — endpoint ini
// hanya boleh dipanggil oleh HR yang login, bukan kandidat via link email.
router.put("/:id/onboarding-sent", authMiddleware, updateOnboardingSent);

module.exports = router;