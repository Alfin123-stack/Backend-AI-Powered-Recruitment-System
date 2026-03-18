const router = require("express").Router()
const multer = require("multer")
const upload = multer()

const { analyze } = require("../controllers/aiController")

router.post("/analyze", upload.single("cv"), analyze)

module.exports = router