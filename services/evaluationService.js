const evaluationRepository = require("../repositories/evaluationRepository");
const companyRepository = require("../repositories/companyRepository");
const { createNotification } = require("../controllers/notificationController");
const { NotFoundError, ForbiddenError, ValidationError } = require("../utils/errors");

const VALID_RECOMMENDATIONS = ["hire", "reject", "consider"];

// Pastikan HR yang login memang pemilik company dari application ini,
// sebelum boleh nulis/baca data sensitif. Return application row (termasuk
// candidate_id, dibutuhkan buat notifikasi) atau throw ForbiddenError.
async function assertApplicationOwnedByHR(applicationId, hrId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError();

  const app = await evaluationRepository.findApplicationForHROwnership(applicationId);
  if (!app || app.jobs?.company_id !== company.id) throw new ForbiddenError();

  return app;
}

async function createEvaluation(hrId, payload) {
  const { application_id, interview_id, score, recommendation, notes } = payload;

  if (!application_id) throw new ValidationError("application_id wajib diisi");

  if (!VALID_RECOMMENDATIONS.includes(recommendation)) {
    throw new ValidationError("recommendation tidak valid");
  }

  const scoreNum = Number(score);
  if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
    throw new ValidationError("score harus angka bulat 1-10");
  }

  const app = await assertApplicationOwnedByHR(application_id, hrId);

  // Kalau interview_id dikirim, pastikan interview itu memang punya
  // application yang sama -- cegah cross-linking evaluasi ke interview
  // milik kandidat lain.
  if (interview_id) {
    const interview = await evaluationRepository.findInterviewById(interview_id);
    if (!interview || interview.application_id !== application_id) {
      throw new ValidationError("interview_id tidak sesuai dengan application_id");
    }
  }

  const { data, error } = await evaluationRepository.insert({
    application_id,
    interview_id: interview_id || null,
    evaluator_id: hrId,
    score: scoreNum,
    recommendation,
    notes: notes || null,
  });
  if (error) throw error;

  await notifyCandidate(app.candidate_id, application_id, recommendation, notes);

  return data;
}

// Notifikasi ke kandidat begitu evaluasi tersimpan -- backend jadi
// satu-satunya sumber notifikasi evaluasi (bukan lagi dari Next.js action).
async function notifyCandidate(candidateId, applicationId, recommendation, notes) {
  const jobDetail = await evaluationRepository.findJobDetailByApplicationId(applicationId);
  const jobTitle = jobDetail?.jobs?.title || "posisi ini";
  const companyName = jobDetail?.jobs?.companies?.name || "perusahaan ini";
  const evaluationDetailHint =
    "Buka halaman Applications, pilih tab Interview, lalu lihat detail interview ini untuk membaca hasil evaluasi lengkapnya.";

  const candidateNotifMap = {
    hire: {
      type: "status_update",
      title: "Kabar Baik dari Tim HR 🎉",
      message: `Hasil interview kamu untuk posisi ${jobTitle} sudah keluar. ${evaluationDetailHint} Tunggu kabar selanjutnya dari tim HR ya.`,
      metadata: { application_id: applicationId, job_title: jobTitle },
    },
    consider: {
      type: "status_update",
      title: "Evaluasi Interview Selesai",
      message: `Interview kamu untuk posisi ${jobTitle} sudah selesai dievaluasi dan sedang dipertimbangkan lebih lanjut oleh tim HR. ${evaluationDetailHint}`,
      metadata: { application_id: applicationId, job_title: jobTitle },
    },
    reject: {
      type: "rejection",
      title: `Update Lamaran — ${jobTitle}`,
      message: notes
        ? `Terima kasih sudah meluangkan waktu untuk interview di ${companyName}. Untuk saat ini, tim HR memutuskan melanjutkan dengan kandidat lain. Catatan dari HR: "${notes}". ${evaluationDetailHint}`
        : `Terima kasih sudah meluangkan waktu untuk interview posisi ${jobTitle} di ${companyName}. Untuk saat ini, tim HR memutuskan melanjutkan dengan kandidat lain. ${evaluationDetailHint}`,
      metadata: {
        application_id: applicationId,
        job_title: jobTitle,
        company_name: companyName,
        feedback: notes || null,
      },
    },
  };

  const n = candidateNotifMap[recommendation];
  await createNotification(candidateId, n.type, n.title, n.message, n.metadata);
}

// HR (pemilik company job ini) lihat versi lengkap termasuk notes & nama
// evaluator. Candidate (pemilik application) lihat score, recommendation,
// notes, dan tanggal -- tanpa nama evaluator (identitas internal HR tetap
// disembunyikan dari candidate).
async function getEvaluationsByApplication(userId, role, applicationId) {
  const { data: app, error: appError } = await evaluationRepository.findApplicationForAccessCheck(
    applicationId,
  );
  if (appError || !app) throw new NotFoundError("Lamaran tidak ditemukan");

  const isOwnerHR = role === "hr" && app.jobs?.companies?.hr_id === userId;
  const isOwnerCandidate = userId === app.candidate_id;

  if (!isOwnerHR && !isOwnerCandidate) throw new ForbiddenError();

  const { data, error } = await evaluationRepository.findByApplicationId(applicationId);
  if (error) throw error;

  if (isOwnerHR) {
    return data.map((e) => ({
      id: e.id,
      interview_id: e.interview_id,
      evaluator_name: e.users?.full_name || "—",
      score: e.score,
      recommendation: e.recommendation,
      notes: e.notes,
      created_at: e.created_at,
    }));
  }

  // Candidate: full feedback minus identitas evaluator internal
  return data.map((e) => ({
    id: e.id,
    score: e.score,
    recommendation: e.recommendation,
    notes: e.notes,
    created_at: e.created_at,
  }));
}

module.exports = { createEvaluation, getEvaluationsByApplication };
