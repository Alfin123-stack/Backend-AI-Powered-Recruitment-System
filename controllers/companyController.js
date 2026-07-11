const companyService = require("../services/companyService");

// ── GET MY COMPANY ─────────────────────────────────────────
exports.getMyCompany = async (req, res, next) => {
  try {
    const data = await companyService.getMyCompany(req.user.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── CREATE COMPANY ─────────────────────────────────────────
exports.createCompany = async (req, res, next) => {
  try {
    const data = await companyService.createCompany(req.user.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE COMPANY ─────────────────────────────────────────
exports.updateCompany = async (req, res, next) => {
  try {
    const data = await companyService.updateCompany(req.user.id, req.body);
    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET PUBLIC COMPANIES ───────────────────────────────────
exports.getPublicCompanies = async (req, res, next) => {
  try {
    const result = await companyService.getPublicCompanies();
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── GET COMPANY BY ID (public) ─────────────────────────────
exports.getCompanyById = async (req, res, next) => {
  try {
    const result = await companyService.getCompanyById(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
