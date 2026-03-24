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

router.get("/my", authMiddleware, getMyJobs); // ← harus sebelum /:id
router.get("/", getJobs);
router.get("/:id", getJobById); // ← public, setelah /my
router.post("/create", authMiddleware, createJob);
router.put("/:id", authMiddleware, updateJob);
router.delete("/:id", authMiddleware, deleteJob);

module.exports = router;
