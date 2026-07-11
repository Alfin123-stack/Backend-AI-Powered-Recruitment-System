const jobService = require("../services/jobService");

// ── CREATE JOB ─────────────────────────────────────────────
exports.createJob = async (req, res, next) => {
  try {
    const data = await jobService.createJob(req.user.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET ALL JOBS (public) ───────────────────────────────────
exports.getJobs = async (req, res, next) => {
  try {
    const data = await jobService.getJobs();
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET JOB BY ID (public) ─────────────────────────────────
exports.getJobById = async (req, res, next) => {
  try {
    const data = await jobService.getJobById(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE JOB ─────────────────────────────────────────────
exports.updateJob = async (req, res, next) => {
  try {
    const data = await jobService.updateJob(req.user.id, req.params.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── DELETE JOB (soft delete) ───────────────────────────────
exports.deleteJob = async (req, res, next) => {
  try {
    const result = await jobService.deleteJob(req.user.id, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── GET MY JOBS (HR only) ──────────────────────────────────
exports.getMyJobs = async (req, res, next) => {
  try {
    const data = await jobService.getMyJobs(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};
