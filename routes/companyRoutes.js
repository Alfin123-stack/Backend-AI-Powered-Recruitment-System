const router = require("express").Router();
const {
  createCompany,
  getMyCompany,
  updateCompany,
  getPublicCompanies,
} = require("../controllers/companyController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", getPublicCompanies); // public — untuk halaman /company
router.get("/me", authMiddleware, getMyCompany); // HR only
router.post("/create", authMiddleware, createCompany); // HR only
router.put("/update", authMiddleware, updateCompany); // HR only


module.exports = router;
