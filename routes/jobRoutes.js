const router = require("express").Router();

const { createJob } = require("../controllers/jobController");

router.post("/create", createJob);

module.exports = router;
