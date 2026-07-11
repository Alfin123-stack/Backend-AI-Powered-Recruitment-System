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
const checkRole = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { applyJobSchema } = require("../validators/applicationValidator");

router.get("/hr", authMiddleware, checkRole("hr"), getHRApplications);
router.post("/apply", authMiddleware, checkRole("candidate"), validate(applyJobSchema), applyJob); // candidate apply job
router.get("/my", authMiddleware, getMyApplications);
router.put("/:id/status", authMiddleware, checkRole("hr"), updateApplicationStatus);
router.get("/check/:job_id", authMiddleware, checkApplied);


router.post("/:id/offer-token", authMiddleware, checkRole("hr"), createOfferToken);
router.put("/:id/offer", offerAuthMiddleware, updateOfferStatus);
// TAMBAHAN: authMiddleware biasa (bukan offerAuthMiddleware) — endpoint ini
// hanya boleh dipanggil oleh HR yang login, bukan kandidat via link email.
router.put("/:id/onboarding-sent", authMiddleware, checkRole("hr"), updateOnboardingSent);

module.exports = router;
