const router = require("express").Router();
const {
  createCompany,
  getMyCompany,
  updateCompany,
  getPublicCompanies,
  getCompanyById, // ← tambahan baru
} = require("../controllers/companyController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", getPublicCompanies); // public — daftar semua company
router.get("/me", authMiddleware, getMyCompany); // HR only — company milik sendiri
router.get("/:id", getCompanyById); // public — detail company + jobs ✅
router.post("/create", authMiddleware, createCompany);
router.put("/update", authMiddleware, updateCompany);

module.exports = router;
