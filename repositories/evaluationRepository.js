const supabase = require("../config/supabase");

// Dipakai getOwnedApplicationForHR (service) -- select juga candidate_id
// karena dibutuhkan untuk kirim notifikasi ke kandidat setelah evaluasi
// tersimpan.
async function findApplicationForHROwnership(applicationId) {
  const { data } = await supabase
    .from("applications")
    .select("id, candidate_id, jobs(company_id)")
    .eq("id", applicationId)
    .single();
  return data;
}

// Dipakai getEvaluationsByApplication -- shape beda dikit (butuh hr_id,
// bukan company_id) karena ownership check di sini beda arah (candidate
// ATAU HR boleh lihat, bukan cuma HR).
async function findApplicationForAccessCheck(applicationId) {
  const { data, error } = await supabase
    .from("applications")
    .select("id, candidate_id, jobs(companies(hr_id))")
    .eq("id", applicationId)
    .single();
  return { data, error };
}

async function findInterviewById(interviewId) {
  const { data } = await supabase
    .from("interviews")
    .select("id, application_id")
    .eq("id", interviewId)
    .single();
  return data;
}

async function insert(payload) {
  const { data, error } = await supabase.from("evaluations").insert([payload]).select().single();
  return { data, error };
}

async function findByApplicationId(applicationId) {
  const { data, error } = await supabase
    .from("evaluations")
    .select("id, interview_id, evaluator_id, score, recommendation, notes, created_at, users(full_name)")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });
  return { data, error };
}

// Dipakai untuk ambil job title + company name saat kirim notifikasi
// evaluasi ke kandidat.
async function findJobDetailByApplicationId(applicationId) {
  const { data } = await supabase
    .from("applications")
    .select("jobs(title, companies(name))")
    .eq("id", applicationId)
    .single();
  return data;
}

module.exports = {
  findApplicationForHROwnership,
  findApplicationForAccessCheck,
  findInterviewById,
  insert,
  findByApplicationId,
  findJobDetailByApplicationId,
};
