const applicationService = require("../services/applicationService");

// ── GET HR APPLICATIONS ────────────────────────────────────
exports.getHRApplications = async (req, res, next) => {
  try {
    const result = await applicationService.getHRApplications(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE STATUS APPLICATION ──────────────────────────────
// `skipStatusNotification` — dikirim oleh caller (sendRejectionAction) yang
// SUDAH mengirim notifikasi lebih kaya sendiri (lewat createEvaluation di
// evaluationController.js, untuk kasus rejected) sebelum memanggil endpoint
// ini. Tanpa flag ini, notifMap di applicationService akan membuat
// notifikasi KEDUA untuk kejadian yang sama.
//
// Field tambahan (salary, start_date, notes, expires_at, accept_url,
// decline_url) HANYA dipakai saat status === "offered" — dikirim oleh
// sendOfferLetterAction supaya notifikasi "offer_letter" ke kandidat bisa
// dibuat di backend, bukan lagi manual dari Next.js action.
exports.updateApplicationStatus = async (req, res, next) => {
  try {
    const result = await applicationService.updateApplicationStatus(
      req.user.id,
      req.params.id,
      req.body,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── APPLY JOB ──────────────────────────────────────────────
exports.applyJob = async (req, res, next) => {
  try {
    const application = await applicationService.applyJob(req.user.id, req.body);
    res.status(201).json(application);
  } catch (err) {
    next(err);
  }
};

// ── GET MY APPLICATIONS (candidate) ───────────────────────
exports.getMyApplications = async (req, res, next) => {
  try {
    const result = await applicationService.getMyApplications(req.user.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── CHECK APPLIED ──────────────────────────────────────────
exports.checkApplied = async (req, res, next) => {
  try {
    const result = await applicationService.checkApplied(req.user.id, req.params.job_id);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── CREATE OFFER TOKEN ──────────────────────────────────────
// Dipanggil oleh Next.js server action (sendOfferLetterAction) SEBELUM
// mengirim email, dengan Bearer token milik HR yang sedang login.
// Backend generate signed token (HMAC) yang nanti disisipkan HR ke
// acceptUrl/declineUrl di email, supaya kandidat bisa merespons tanpa perlu
// login. Endpoint ini juga menandai offer sebagai "pending" di DB.
exports.createOfferToken = async (req, res, next) => {
  try {
    const token = await applicationService.createOfferToken(
      req.user.id,
      req.params.id,
      req.body.expires_at,
    );
    res.json({ token });
  } catch (err) {
    next(err);
  }
};

// ── UPDATE OFFER STATUS (accept / decline) ─────────────────
// Dilindungi offerAuthMiddleware, bukan authMiddleware biasa — bisa diakses
// lewat session kandidat (dashboard) ATAU signed token dari link email
// (req.offerAuthVia menandai jalur mana yang dipakai).
exports.updateOfferStatus = async (req, res, next) => {
  try {
    const result = await applicationService.updateOfferStatus(
      req.offerAuthVia,
      req.user?.id,
      req.params.id,
      req.body.offer_status,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE ONBOARDING SENT FLAG ─────────────────────────────
// Dipanggil oleh Next.js server action (sendOnboardingEmailAction) SETELAH
// berhasil mengirim email detail onboarding ke kandidat — supaya tombol
// "Kirim Onboarding Email" di dashboard HR berubah jadi "Sudah Dikirim" dan
// tidak bisa dikirim dobel ke kandidat yang sama.
exports.updateOnboardingSent = async (req, res, next) => {
  try {
    const result = await applicationService.updateOnboardingSent(
      req.user.id,
      req.params.id,
      req.body.onboarding_sent,
    );
    res.json(result);
  } catch (err) {
    next(err);
  }
};
