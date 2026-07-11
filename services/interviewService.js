const interviewRepository = require("../repositories/interviewRepository");
const jobRepository = require("../repositories/jobRepository");
const companyRepository = require("../repositories/companyRepository");
const userRepository = require("../repositories/userRepository");
const { createNotification } = require("../controllers/notificationController");
const { ForbiddenError, ValidationError } = require("../utils/errors");

const VALID_STATUSES = ["scheduled", "done", "cancelled"];

function formatSchedule(dateStr) {
  const date = new Date(dateStr);
  const tanggal = date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" });
  const jam = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
  return { tanggal, jam };
}

// ── GET ALL INTERVIEWS milik HR ────────────────────────────
async function getHRInterviews(hrId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) return [];

  const jobs = await jobRepository.findIdsByCompanyId(company.id);
  if (jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const applications = await interviewRepository.findApplicationsByJobIds(jobIds);
  if (applications.length === 0) return [];

  const appIds = applications.map((a) => a.id);
  const { data: interviews, error } = await interviewRepository.findByApplicationIds(appIds);
  if (error) throw error;

  const candidateIds = [...new Set(applications.map((a) => a.candidate_id))];
  const users = await userRepository.findByIds(candidateIds);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u;
  });

  const appMap = {};
  applications.forEach((a) => {
    appMap[a.id] = a;
  });

  return (interviews || []).map((iv) => {
    const app = appMap[iv.application_id];
    const candidate = app ? userMap[app.candidate_id] : null;
    return {
      id: iv.id,
      application_id: iv.application_id,
      scheduled_at: iv.scheduled_at,
      type: iv.type,
      location: iv.location,
      notes: iv.notes,
      status: iv.status,
      application_status: app?.status ?? null,
      offer_status: app?.offer_status ?? null,
      created_at: iv.created_at,
      candidate_name: candidate?.full_name || candidate?.email || "Kandidat",
      candidate_email: candidate?.email || null,
      job_title: app?.jobs?.title || "—",
    };
  });
}

// ── GET SHORTLISTED CANDIDATES (belum dijadwalkan) ─────────
async function getShortlistedCandidates(hrId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) return [];

  const jobs = await jobRepository.findIdsByCompanyId(company.id);
  if (jobs.length === 0) return [];

  const jobIds = jobs.map((j) => j.id);
  const { data: applications, error } = await interviewRepository.findShortlistedApplications(jobIds);
  if (error) throw error;
  if (!applications || applications.length === 0) return [];

  const appIds = applications.map((a) => a.id);

  // Block hanya scheduled dan done -- cancelled boleh dijadwalkan ulang
  const existingInterviews = await interviewRepository.findStatusByApplicationIds(appIds);
  const blockedAppIds = new Set(
    existingInterviews
      .filter((iv) => iv.status === "scheduled" || iv.status === "done")
      .map((iv) => iv.application_id),
  );

  const unscheduled = applications.filter((a) => !blockedAppIds.has(a.id));
  if (unscheduled.length === 0) return [];

  const candidateIds = [...new Set(unscheduled.map((a) => a.candidate_id))];
  const users = await userRepository.findByIds(candidateIds);

  const userMap = {};
  users.forEach((u) => {
    userMap[u.id] = u;
  });

  return unscheduled.map((a) => ({
    application_id: a.id,
    candidate_id: a.candidate_id,
    candidate_name: userMap[a.candidate_id]?.full_name || userMap[a.candidate_id]?.email || "Kandidat",
    job_title: a.jobs?.title || "—",
  }));
}

// ── CREATE INTERVIEW ───────────────────────────────────────
async function createInterview(hrId, payload) {
  const {
    application_id,
    scheduled_at,
    type,
    location,
    notes,
    round,
    duration_minutes,
    interviewer_name,
  } = payload;

  if (!application_id || !scheduled_at) {
    throw new ValidationError("application_id dan scheduled_at wajib diisi");
  }

  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError();

  const app = await interviewRepository.findApplicationForOwnership(application_id);
  if (!app || app.jobs?.company_id !== company.id) throw new ForbiddenError();

  // Cek existing interview -- upsert jika ada yang cancelled
  const existing = await interviewRepository.findLatestByApplicationId(application_id);

  const interviewPayload = {
    scheduled_at,
    type: type || "online",
    location: location || null,
    notes: notes || null,
    status: "scheduled",
    round: round || "First Interview",
    duration_minutes: duration_minutes ? Number(duration_minutes) : 60,
    interviewer_name: interviewer_name || null,
  };

  const { data, error } = existing
    ? await interviewRepository.updateInterviewById(existing.id, interviewPayload)
    : await interviewRepository.insertInterview(application_id, interviewPayload);

  if (error) throw error;

  // Trigger notifikasi ke kandidat
  const appDetail = await interviewRepository.findAppDetailForNotif(application_id);
  if (appDetail) {
    const jobTitle = appDetail.jobs?.title || "posisi ini";
    const companyName = appDetail.jobs?.companies?.name || "perusahaan";
    const { tanggal, jam } = formatSchedule(scheduled_at);
    const tipe = (type || "online") === "online" ? "Online" : "Onsite";
    const isReschedule = !!existing;

    await createNotification(
      appDetail.candidate_id,
      "interview",
      isReschedule ? "Interview Dijadwalkan Ulang 🔄" : "Interview Dijadwalkan 📅",
      isReschedule
        ? `Interview ${tipe} untuk ${jobTitle} di ${companyName} telah dijadwalkan ulang pada ${tanggal} pukul ${jam} WIB.`
        : `Interview ${tipe} untuk ${jobTitle} di ${companyName} dijadwalkan pada ${tanggal} pukul ${jam} WIB.`,
    );
  }

  return data;
}

// ── UPDATE INTERVIEW STATUS ────────────────────────────────
async function updateInterview(id, payload) {
  const { status, scheduled_at, type, location, notes } = payload;

  if (status && !VALID_STATUSES.includes(status)) {
    throw new ValidationError("Status tidak valid");
  }

  const { data: oldInterview, error: fetchError } = await interviewRepository.findById(id);
  if (fetchError) throw fetchError;

  const updateData = {};
  if (status) updateData.status = status;
  if (scheduled_at) updateData.scheduled_at = scheduled_at;
  if (type) updateData.type = type;
  if (location !== undefined) updateData.location = location;
  if (notes !== undefined) updateData.notes = notes;

  const { data, error } = await interviewRepository.updateInterviewById(id, updateData);
  if (error) throw error;

  // Trigger notifikasi hanya jika status benar-benar berubah
  if (status && status !== oldInterview.status) {
    const appDetail = await interviewRepository.findAppDetailForNotif(oldInterview.application_id);

    if (appDetail) {
      const jobTitle = appDetail.jobs?.title || "posisi ini";
      const companyName = appDetail.jobs?.companies?.name || "perusahaan";

      if (status === "done") {
        await createNotification(
          appDetail.candidate_id,
          "status_update",
          "Interview Selesai ✅",
          `Interview untuk ${jobTitle} di ${companyName} telah selesai. Semoga hasilnya memuaskan!`,
        );
      }

      if (status === "cancelled") {
        await createNotification(
          appDetail.candidate_id,
          "general",
          "Interview Dibatalkan",
          `Interview untuk ${jobTitle} di ${companyName} telah dibatalkan oleh HR. Nantikan info lebih lanjut.`,
        );
      }

      if (status === "scheduled" && oldInterview.status === "cancelled") {
        const newDate = scheduled_at || oldInterview.scheduled_at;
        const { tanggal, jam } = formatSchedule(newDate);
        const tipe = (type || oldInterview.type) === "online" ? "Online" : "Onsite";

        await createNotification(
          appDetail.candidate_id,
          "interview",
          "Interview Dijadwalkan Ulang 🔄",
          `Interview ${tipe} untuk ${jobTitle} di ${companyName} telah dijadwalkan ulang pada ${tanggal} pukul ${jam} WIB.`,
        );
      }
    }
  }

  return data;
}

// ── GET MY INTERVIEWS (untuk kandidat yang login) ──────────
async function getMyInterviews(candidateId) {
  const { data: applications, error: appError } = await interviewRepository.findApplicationsByCandidateId(
    candidateId,
  );
  if (appError) throw appError;
  if (!applications || applications.length === 0) return [];

  const appIds = applications.map((a) => a.id);
  const { data: interviews, error } = await interviewRepository.findByApplicationIds(appIds);
  if (error) throw error;

  const appMap = {};
  applications.forEach((a) => {
    appMap[a.id] = a;
  });

  return (interviews || []).map((iv) => {
    const app = appMap[iv.application_id];
    return {
      id: iv.id,
      application_id: iv.application_id,
      scheduled_at: iv.scheduled_at,
      type: iv.type,
      location: iv.location,
      notes: iv.notes,
      status: iv.status,
      created_at: iv.created_at,
      job_title: app?.jobs?.title || "—",
      company_name: app?.jobs?.companies?.name || "—",
    };
  });
}

module.exports = {
  getHRInterviews,
  getShortlistedCandidates,
  createInterview,
  updateInterview,
  getMyInterviews,
};
