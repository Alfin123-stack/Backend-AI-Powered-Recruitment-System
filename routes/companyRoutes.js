const router = require("express").Router();
const {
  createCompany,
  getMyCompany,
  updateCompany,
  getPublicCompanies,
  getCompanyById, // ← tambahan baru
} = require("../controllers/companyController");
const authMiddleware = require("../middleware/authMiddleware");
const checkRole = require("../middleware/roleMiddleware");
const validate = require("../middleware/validate");
const { createCompanySchema, updateCompanySchema } = require("../validators/companyValidator");

router.get("/", getPublicCompanies); // public — daftar semua company
router.get("/me", authMiddleware, checkRole("hr"), getMyCompany); // HR only — company milik sendiri
router.get("/:id", getCompanyById); // public — detail company + jobs ✅
router.post("/create", authMiddleware, checkRole("hr"), validate(createCompanySchema), createCompany);
router.put("/update", authMiddleware, checkRole("hr"), validate(updateCompanySchema), updateCompany);

module.exports = router;
