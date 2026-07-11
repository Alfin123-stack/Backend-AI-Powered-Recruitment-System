const interviewService = require("../services/interviewService");

// ── GET ALL INTERVIEWS milik HR ────────────────────────────
exports.getHRInterviews = async (req, res, next) => {
  try {
    const result = await interviewService.getHRInterviews(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── GET SHORTLISTED CANDIDATES (belum dijadwalkan) ─────────
exports.getShortlistedCandidates = async (req, res, next) => {
  try {
    const result = await interviewService.getShortlistedCandidates(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── CREATE INTERVIEW ───────────────────────────────────────
// FIX: `round`, `duration_minutes`, `interviewer_name` sekarang ikut
// diteruskan (lihat interviewService.createInterview) -- sebelumnya
// silently dropped walau frontend sudah mengirimnya.
exports.createInterview = async (req, res, next) => {
  try {
    const data = await interviewService.createInterview(req.user.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE INTERVIEW STATUS ────────────────────────────────
exports.updateInterview = async (req, res, next) => {
  try {
    const data = await interviewService.updateInterview(req.params.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET MY INTERVIEWS (untuk kandidat yang login) ──────────
exports.getMyInterviews = async (req, res, next) => {
  try {
    const result = await interviewService.getMyInterviews(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
