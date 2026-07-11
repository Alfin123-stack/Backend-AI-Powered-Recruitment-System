const router = require("express").Router();
const {
  createJob,
  getJobs,
  getMyJobs,
  getJobById, // ← tambah
  updateJob,
  deleteJob,
} = require("../controllers/jobController");
const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { createJobSchema, updateJobSchema } = require("../validators/jobValidator");

router.get("/my", authMiddleware, checkRole("hr"), getMyJobs); // ← harus sebelum /:id
router.get("/", getJobs);
router.get("/:id", getJobById); // ← public, setelah /my
router.post("/create", authMiddleware, checkRole("hr"), validate(createJobSchema), createJob);
router.put("/:id", authMiddleware, checkRole("hr"), validate(updateJobSchema), updateJob);
router.delete("/:id", authMiddleware, checkRole("hr"), deleteJob);

module.exports = router;
