const supabase = require("../config/supabase");

// ── Ownership check (dipakai updateApplicationStatus, createOfferToken,
//    updateOnboardingSent -- sebelumnya di-copy-paste manual 3x di controller) ──
async function findWithJobCompany(id) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, jobs(company_id)")
    .eq("id", id)
    .single();
  return { data, error };
}

// ── HR: daftar semua applications untuk sekumpulan job_id ──
async function findByJobIds(jobIds) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, offer_status, offer_expires_at, onboarding_sent, cv_url, created_at, candidate_id, job_id,
      jobs(id, title, companies(name)),
      resume_analysis(resume_score, matching_score, extracted_skills)
    `,
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });
  return { data, error };
}

// ── Candidate: apakah sudah pernah apply ke job ini ──
async function findByJobAndCandidate(jobId, candidateId) {
  const { data } = await supabase
    .from("applications")
    .select("id, status")
    .eq("job_id", jobId)
    .eq("candidate_id", candidateId)
    .maybeSingle();
  return data;
}

async function insert(payload) {
  const { data, error } = await supabase
    .from("applications")
    .insert([payload])
    .select()
    .single();
  return { data, error };
}

async function updateStatus(id, status) {
  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", id)
    .select("id, status, candidate_id, jobs(title)")
    .single();
  return { data, error };
}

// ── Candidate: daftar applications milik sendiri ──
async function findByCandidateId(candidateId) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, created_at, cv_url, job_id,
      jobs(title, companies(name)),
      resume_analysis(resume_score, matching_score)
    `,
    )
    .eq("candidate_id", candidateId)
    .order("created_at", { ascending: false });
  return { data, error };
}

async function updateOfferPending(id, expiresAt) {
  const { error } = await supabase
    .from("applications")
    .update({ offer_status: "pending", offer_expires_at: expiresAt })
    .eq("id", id);
  return { error };
}

async function findOfferDetail(id) {
  const { data, error } = await supabase
    .from("applications")
    .select(
      "id, candidate_id, status, offer_status, offer_expires_at, jobs(title, companies(hr_id, name))",
    )
    .eq("id", id)
    .single();
  return { data, error };
}

async function updateOfferStatus(id, updateData) {
  const { data, error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  return { data, error };
}

async function updateOnboardingSent(id, onboardingSent) {
  const { data, error } = await supabase
    .from("applications")
    .update({ onboarding_sent: onboardingSent })
    .eq("id", id)
    .select("id, onboarding_sent, candidate_id, jobs(title)")
    .single();
  return { data, error };
}

async function insertResumeAnalysis(applicationId, analysis) {
  const { error } = await supabase.from("resume_analysis").insert([
    {
      application_id: applicationId,
      resume_score: analysis.resumeScore,
      matching_score: analysis.matchingScore,
      ats_score: analysis.atsScore,
      overall_score: analysis.overallScore,
      extracted_skills: analysis.skills,
      categories: analysis.categories,
      strengths: analysis.strengths,
      improvements: analysis.improvements,
    },
  ]);
  return { error };
}

module.exports = {
  findWithJobCompany,
  findByJobIds,
  findByJobAndCandidate,
  insert,
  updateStatus,
  findByCandidateId,
  updateOfferPending,
  findOfferDetail,
  updateOfferStatus,
  updateOnboardingSent,
  insertResumeAnalysis,
};
