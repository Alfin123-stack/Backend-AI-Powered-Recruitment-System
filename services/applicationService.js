const applicationRepository = require("../repositories/applicationRepository");
const jobRepository = require("../repositories/jobRepository");
const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const { createNotification } = require("../controllers/notificationController");
const { sign } = require("../utils/offerToken");
const { NotFoundError, ForbiddenError, ValidationError, ConflictError } = require("../utils/errors");

const VALID_STATUSES = [
  "applied",
  "review",
  "shortlisted",
  "interview",
  "evaluated",
  "offered",
  "hired",
  "onboard",
  "rejected",
];

// ── Shared ownership check ──────────────────────────────────
// Sebelumnya di-copy-paste manual 3x (updateApplicationStatus,
// createOfferToken, updateOnboardingSent): pastikan application `:id`
// benar-benar milik job di company milik HR yang login. Tanpa ini, HR
// company A bisa memanipulasi data company B cuma dengan ganti :id di URL
// (IDOR). Sekarang jadi satu fungsi, dipanggil di 3 tempat itu.
//
// Return company (dilempar biar caller bisa reuse company.id kalau perlu),
// throw ForbiddenError/NotFoundError kalau tidak valid.
async function assertApplicationOwnedByHR(hrId, applicationId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError();

  const { data: app, error } = await applicationRepository.findWithJobCompany(applicationId);
  if (error || !app) throw new NotFoundError("Lamaran tidak ditemukan");

  if (app.jobs?.company_id !== company.id) throw new ForbiddenError();

  return company;
}

// ── GET HR APPLICATIONS ─────────────────────────────────────
async function getHRApplications(hrId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) return [];

  const jobs = await jobRepository.findIdsByCompanyId(company.id);
  if (jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);

  const { data, error } = await applicationRepository.findByJobIds(jobIds);
  if (error) throw error;

  const candidateIds = [...new Set(data.map((a) => a.candidate_id))];
  const users = await userRepository.findByIds(candidateIds);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u;
  });

  return data.map((a) => ({
    id: a.id,
    status: a.status,
    offer_status: a.offer_status ?? null,
    offer_expires_at: a.offer_expires_at ?? null,
    onboarding_sent: a.onboarding_sent ?? false,
    cv_url: a.cv_url || null,
    created_at: a.created_at,
    candidate_name: userMap[a.candidate_id]?.full_name || userMap[a.candidate_id]?.email || "Kandidat",
    candidate_email: userMap[a.candidate_id]?.email || null,
    job_id: a.jobs?.id,
    job_title: a.jobs?.title,
    company_name: a.jobs?.companies?.name || null,
    resume_score: a.resume_analysis?.resume_score ?? 0,
    matching_score: a.resume_analysis?.matching_score ?? 0,
    extracted_skills: a.resume_analysis?.extracted_skills || [],
  }));
}

// ── UPDATE APPLICATION STATUS ────────────────────────────────
async function updateApplicationStatus(hrId, applicationId, payload) {
  const {
    status,
    skipStatusNotification,
    salary,
    start_date,
    notes,
    expires_at,
    accept_url,
    decline_url,
  } = payload;

  if (!VALID_STATUSES.includes(status)) {
    throw new ValidationError("Status tidak valid");
  }

  await assertApplicationOwnedByHR(hrId, applicationId);

  const { data, error } = await applicationRepository.updateStatus(applicationId, status);
  if (error) throw error;

  const jobTitle = data.jobs?.title || "posisi ini";

  // Notifikasi ke kandidat -- notifMap generik per status.
  const notifMap = {
    review: {
      type: "status_update",
      title: "Lamaran Sedang Direview",
      message: `Lamaranmu untuk ${jobTitle} sedang ditinjau oleh tim HR.`,
    },
    shortlisted: {
      type: "status_update",
      title: "Kamu Shortlisted! 🎉",
      message: `Selamat! Lamaranmu untuk ${jobTitle} lolos ke tahap berikutnya.`,
    },
    interview: {
      type: "status_update",
      title: "Interview Dijadwalkan 📅",
      message: `Kamu dijadwalkan untuk interview posisi ${jobTitle}. Cek detail jadwalnya di dashboard.`,
    },
    rejected: {
      type: "general",
      title: "Update Status Lamaran",
      message: `Lamaranmu untuk ${jobTitle} tidak dilanjutkan. Jangan menyerah!`,
    },
    offered: {
      type: "offer_letter",
      title: `🎉 Job Offer — ${jobTitle}`,
      message: `Kamu mendapat offer untuk posisi ${jobTitle}.${salary ? ` Salary: ${salary}.` : ""} Detail lengkap offer letter-nya sudah dikirim ke emailmu — jangan lupa cek folder spam/promosi juga kalau belum kelihatan di inbox.`,
    },
  };

  if (notifMap[status] && !skipStatusNotification) {
    const n = notifMap[status];
    const metadata =
      status === "offered"
        ? {
            application_id: applicationId,
            job_title: jobTitle,
            salary: salary ?? null,
            start_date: start_date ?? null,
            notes: notes ?? null,
            expires_at: expires_at ?? null,
            offer_status: "pending",
            accept_url: accept_url ?? null,
            decline_url: decline_url ?? null,
          }
        : { application_id: applicationId, job_title: jobTitle };

    await createNotification(data.candidate_id, n.type, n.title, n.message, metadata);
  }

  // Notifikasi ke HR sendiri (audit-trail record)
  const hrNotifMap = {
    offered: {
      title: "Offer Letter Terkirim 📨",
      message: `Offer letter untuk posisi ${jobTitle} berhasil dikirim ke kandidat.`,
    },
  };

  if (hrNotifMap[status]) {
    const n = hrNotifMap[status];
    await createNotification(hrId, "status_update", n.title, n.message, {
      application_id: applicationId,
      job_title: jobTitle,
    });
  }

  return data;
}

// ── APPLY JOB (candidate) ────────────────────────────────────
async function applyJob(candidateId, payload) {
  const { job_id, cv_url, analysis } = payload;

  if (!job_id) throw new ValidationError("job_id wajib diisi");

  const existing = await applicationRepository.findByJobAndCandidate(job_id, candidateId);
  if (existing) throw new ConflictError("Kamu sudah melamar ke posisi ini");

  const { data: application, error: appError } = await applicationRepository.insert({
    job_id,
    candidate_id: candidateId,
    cv_url: cv_url || null,
    status: "applied",
  });
  if (appError) throw appError;

  const jobDetail = await jobRepository.findJobWithCompany(job_id);
  const candidateDetail = await userRepository.findById(candidateId);
  const candidateName = candidateDetail?.full_name || candidateDetail?.email || "Kandidat";

  if (jobDetail) {
    const jobTitle = jobDetail.title;
    const companyName = jobDetail.companies?.name || "perusahaan";
    const hrId = jobDetail.companies?.hr_id;

    await createNotification(
      candidateId,
      "general",
      "Lamaran Terkirim ✅",
      `Lamaranmu untuk ${jobTitle} di ${companyName} berhasil dikirim. Pantau terus statusnya!`,
      { application_id: application.id, job_title: jobTitle, company_name: companyName },
    );

    if (hrId) {
      await createNotification(
        hrId,
        "general",
        "Lamaran Baru Masuk 📄",
        `${candidateName} baru saja melamar posisi ${jobTitle}.`,
        { application_id: application.id, job_title: jobTitle },
      );
    }
  }

  if (analysis) {
    const { error: analysisError } = await applicationRepository.insertResumeAnalysis(application.id, analysis);
    if (analysisError) {
      // Non-critical -- lamaran sudah tersimpan, analisis CV gagal disimpan
      // tidak boleh menggagalkan seluruh request apply. Cukup di-log.
      const logger = require("../utils/logger");
      logger.error({ err: analysisError }, "Gagal simpan resume analysis");
    }
  }

  return application;
}

// ── GET MY APPLICATIONS (candidate) ──────────────────────────
async function getMyApplications(candidateId) {
  const { data, error } = await applicationRepository.findByCandidateId(candidateId);
  if (error) throw error;

  return data.map((a) => ({
    id: a.id,
    job_id: a.job_id,
    status: a.status,
    created_at: a.created_at,
    cv_url: a.cv_url || null,
    job_title: a.jobs?.title || "—",
    company_name: a.jobs?.companies?.name || "—",
    resume_score: a.resume_analysis?.resume_score ?? 0,
    matching_score: a.resume_analysis?.matching_score ?? 0,
  }));
}

// ── CHECK APPLIED ─────────────────────────────────────────────
async function checkApplied(candidateId, jobId) {
  const data = await applicationRepository.findByJobAndCandidate(jobId, candidateId);
  return { applied: !!data, status: data?.status || null };
}

// ── CREATE OFFER TOKEN ─────────────────────────────────────────
async function createOfferToken(hrId, applicationId, expiresAt) {
  if (!expiresAt) throw new ValidationError("expires_at wajib diisi");

  await assertApplicationOwnedByHR(hrId, applicationId);

  const { error } = await applicationRepository.updateOfferPending(applicationId, expiresAt);
  if (error) throw error;

  return sign(applicationId, expiresAt); // bisa throw -- diteruskan ke caller
}

// ── UPDATE OFFER STATUS (accept/decline) ────────────────────────
async function updateOfferStatus(offerAuthVia, userId, applicationId, offerStatus) {
  const VALID_OFFER_STATUSES = ["accepted", "declined"];
  if (!VALID_OFFER_STATUSES.includes(offerStatus)) {
    throw new ValidationError("offer_status tidak valid");
  }

  const { data: app, error: appError } = await applicationRepository.findOfferDetail(applicationId);
  if (appError || !app) throw new NotFoundError("Lamaran tidak ditemukan");

  if (offerAuthVia === "session" && userId !== app.candidate_id) {
    throw new ForbiddenError();
  }

  if (app.offer_expires_at && new Date(app.offer_expires_at) < new Date()) {
    const { AppError } = require("../utils/errors");
    throw new AppError("Offer sudah kedaluwarsa", 410);
  }

  if (app.offer_status && app.offer_status !== "pending") {
    throw new ConflictError(`Offer sudah pernah direspons sebelumnya (${app.offer_status})`);
  }

  const updateData = { offer_status: offerStatus };
  if (offerStatus === "accepted") updateData.status = "hired";

  const { data, error } = await applicationRepository.updateOfferStatus(applicationId, updateData);
  if (error) throw error;

  const jobTitle = app.jobs?.title || "posisi ini";
  const isAccepted = offerStatus === "accepted";

  // Sync notifikasi offer_letter lama supaya OfferNotifCard di dashboard
  // ikut mencerminkan accepted/declined -- non-critical, jangan gagalkan
  // seluruh request kalau ini error.
  try {
    const supabase = require("../config/supabase");
    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("id, metadata")
      .eq("application_id", applicationId)
      .eq("type", "offer_letter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNotif) {
      await supabase
        .from("notifications")
        .update({
          title: isAccepted ? `Offer Diterima — ${jobTitle}` : `Offer Ditolak — ${jobTitle}`,
          message: isAccepted
            ? `Kamu telah menerima offer untuk posisi ${jobTitle}.`
            : `Kamu telah menolak offer untuk posisi ${jobTitle}.`,
          metadata: { ...(existingNotif.metadata || {}), offer_status: offerStatus },
          read: false,
        })
        .eq("id", existingNotif.id);
    }
  } catch (notifSyncErr) {
    const logger = require("../utils/logger");
    logger.error({ err: notifSyncErr }, "[updateOfferStatus] Gagal sync notification metadata");
  }

  const hrId = app.jobs?.companies?.hr_id;

  if (hrId) {
    await createNotification(
      hrId,
      "status_update",
      isAccepted ? "Offer Diterima 🎉" : "Offer Ditolak",
      `Kandidat telah ${isAccepted ? "menerima" : "menolak"} offer untuk posisi ${jobTitle}.`,
      { application_id: applicationId, job_title: jobTitle, offer_status: offerStatus },
    );
  }

  await createNotification(
    app.candidate_id,
    "status_update",
    isAccepted ? "Selamat! Kamu Resmi Diterima 🎉" : "Offer Berhasil Ditolak",
    isAccepted
      ? `Selamat! Kamu resmi diterima untuk posisi ${jobTitle}. Kami menantikan kehadiranmu di tim.`
      : `Kamu telah menolak offer untuk posisi ${jobTitle}.`,
    { application_id: applicationId, job_title: jobTitle, offer_status: offerStatus },
  );

  const candidateDetail = await userRepository.findById(app.candidate_id);

  return {
    ...data,
    candidate_name: candidateDetail?.full_name || candidateDetail?.email || null,
    candidate_email: candidateDetail?.email || null,
    job_title: jobTitle,
    company_name: app.jobs?.companies?.name || null,
  };
}

// ── UPDATE ONBOARDING SENT FLAG ──────────────────────────────
async function updateOnboardingSent(hrId, applicationId, onboardingSent) {
  if (typeof onboardingSent !== "boolean") {
    throw new ValidationError("onboarding_sent harus boolean");
  }

  await assertApplicationOwnedByHR(hrId, applicationId);

  const { data, error } = await applicationRepository.updateOnboardingSent(applicationId, onboardingSent);
  if (error) throw error;

  if (onboardingSent) {
    const jobTitle = data.jobs?.title || "posisi ini";

    await createNotification(
      hrId,
      "status_update",
      "Onboarding Email Terkirim 📋",
      `Detail onboarding untuk posisi ${jobTitle} berhasil dikirim ke kandidat.`,
      { application_id: applicationId, job_title: jobTitle },
    );

    await createNotification(
      data.candidate_id,
      "status_update",
      "Selamat, Kamu Sudah Onboard! 🎊",
      `Selamat bergabung! Detail onboarding untuk posisi ${jobTitle} sudah dikirim ke emailmu — cek email untuk lihat apa saja yang perlu kamu siapkan sebelum hari pertama.`,
      { application_id: applicationId, job_title: jobTitle },
    );
  }

  return data;
}

module.exports = {
  getHRApplications,
  updateApplicationStatus,
  applyJob,
  getMyApplications,
  checkApplied,
  createOfferToken,
  updateOfferStatus,
  updateOnboardingSent,
};
