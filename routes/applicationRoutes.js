const router = require("express").Router();

const { applyJob } = require("../controllers/applicationController");

router.post("/apply", applyJob);

module.exports = router;
