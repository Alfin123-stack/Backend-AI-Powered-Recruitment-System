const evaluationService = require("../services/evaluationService");

// ── CREATE EVALUATION (HR only) ─────────────────────────────
exports.createEvaluation = async (req, res, next) => {
  try {
    const data = await evaluationService.createEvaluation(req.user.id, req.body);
    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET EVALUATIONS BY APPLICATION (HR & candidate) ─────────
exports.getEvaluationsByApplication = async (req, res, next) => {
  try {
    const result = await evaluationService.getEvaluationsByApplication(
      req.user.id,
      req.user.role,
      req.params.applicationId,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
