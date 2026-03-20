const router = require("express").Router();
const { analyze } = require("../controllers/aiController");

router.post("/analyze", analyze);

module.exports = router;
