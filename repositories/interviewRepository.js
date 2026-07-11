const supabase = require("../config/supabase");

// ── Applications (dipakai buat scoping ke company milik HR) ──
async function findApplicationsByJobIds(jobIds) {
  const { data } = await supabase
    .from("applications")
    .select("id, candidate_id, job_id, status, offer_status, jobs(title)")
    .in("job_id", jobIds);
  return data || [];
}

async function findShortlistedApplications(jobIds) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, candidate_id, job_id, jobs(title)")
    .in("job_id", jobIds)
    .eq("status", "shortlisted");
  return { data, error };
}

async function findApplicationForOwnership(applicationId) {
  const { data } = await supabase
    .from("applications")
    .select("id, jobs(company_id)")
    .eq("id", applicationId)
    .single();
  return data;
}

async function findApplicationsByCandidateId(candidateId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, job_id, jobs(title, company_id, companies(name))")
    .eq("candidate_id", candidateId);
  return { data, error };
}

// Dipakai buat notifikasi (createInterview & updateInterview)
async function findAppDetailForNotif(applicationId) {
  const { data } = await supabase
    .from("applications")
    .select("candidate_id, jobs(title, companies(name))")
    .eq("id", applicationId)
    .single();
  return data;
}

// ── Interviews ─────────────────────────────────────────────
async function findByApplicationIds(appIds) {
  const { data, error } = await supabase
    .from("interviews")
    .select("*")
    .in("application_id", appIds)
    .order("scheduled_at", { ascending: true });
  return { data, error };
}

async function findStatusByApplicationIds(appIds) {
  const { data } = await supabase
    .from("interviews")
    .select("application_id, status")
    .in("application_id", appIds);
  return data || [];
}

async function findLatestByApplicationId(applicationId) {
  const { data } = await supabase
    .from("interviews")
    .select("id, status")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

async function insertInterview(applicationId, payload) {
  const { data, error } = await supabase
    .from("interviews")
    .insert([{ application_id: applicationId, ...payload }])
    .select()
    .single();
  return { data, error };
}

async function updateInterviewById(id, payload) {
  const { data, error } = await supabase
    .from("interviews")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

async function findById(id) {
  const { data, error } = await supabase
    .from("interviews")
    .select("application_id, status, scheduled_at, type")
    .eq("id", id)
    .single();
  return { data, error };
}

module.exports = {
  findApplicationsByJobIds,
  findShortlistedApplications,
  findApplicationForOwnership,
  findApplicationsByCandidateId,
  findAppDetailForNotif,
  findByApplicationIds,
  findStatusByApplicationIds,
  findLatestByApplicationId,
  insertInterview,
  updateInterviewById,
  findById,
};
