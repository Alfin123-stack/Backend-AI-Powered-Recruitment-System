const router = require("express").Router();
const {
  getSavedJobs,
  saveJob,
  unsaveJob,
  checkSaved,
} = require("../controllers/savedjobController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getSavedJobs); // ambil semua saved jobs
router.post("/", authMiddleware, saveJob); // save job
router.delete("/:job_id", authMiddleware, unsaveJob); // unsave job
router.get("/check/:job_id", authMiddleware, checkSaved); // cek sudah disave?

module.exports = router;
