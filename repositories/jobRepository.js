const supabase = require("../config/supabase");

// Dipakai applicationService.applyJob() untuk ambil detail job + company
// saat kandidat baru saja apply (butuh company name & hr_id buat notifikasi).
async function findJobWithCompany(jobId) {
  const { data } = await supabase
    .from("jobs")
    .select("title, companies(id, name, hr_id)")
    .eq("id", jobId)
    .single();
  return data;
}

// Dipakai getHRApplications() untuk ambil semua job_id milik company HR.
async function findIdsByCompanyId(companyId) {
  const { data } = await supabase
    .from("jobs")
    .select("id")
    .eq("company_id", companyId);
  return data || [];
}

async function insert(companyId, payload) {
  const { data, error } = await supabase
    .from("jobs")
    .insert([{ company_id: companyId, ...payload, is_active: true }])
    .select()
    .single();
  return { data, error };
}

async function findAllActive() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, companies(name, logo_url, company_size)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return { data, error };
}

async function findActiveById(id) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, companies(id, name, description, company_size, logo_url)")
    .eq("id", id)
    .eq("is_active", true)
    .single();
  return { data, error };
}

async function findAllByCompanyId(companyId) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  return { data, error };
}

// Dipakai getCompanyById -- kolom spesifik yang dibutuhkan halaman detail company
async function findActiveDetailedByCompanyId(companyId) {
  const { data, error } = await supabase
    .from("jobs")
    .select(
      "id, title, description, requirements, salary, location, type, skills, benefits, deadline, is_active, created_at, company_id",
    )
    .eq("company_id", companyId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  return { data, error };
}

async function updateByIdAndCompany(id, companyId, updates) {
  const { data, error } = await supabase
    .from("jobs")
    .update(updates)
    .eq("id", id)
    .eq("company_id", companyId) // double check ownership
    .select()
    .single();
  return { data, error };
}

async function softDeleteByIdAndCompany(id, companyId) {
  const { error } = await supabase
    .from("jobs")
    .update({ is_active: false })
    .eq("id", id)
    .eq("company_id", companyId);
  return { error };
}

module.exports = {
  findJobWithCompany,
  findIdsByCompanyId,
  insert,
  findAllActive,
  findActiveById,
  findAllByCompanyId,
  findActiveDetailedByCompanyId,
  updateByIdAndCompany,
  softDeleteByIdAndCompany,
};
