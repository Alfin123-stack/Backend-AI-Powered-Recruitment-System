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

module.exports = { findJobWithCompany, findIdsByCompanyId };
