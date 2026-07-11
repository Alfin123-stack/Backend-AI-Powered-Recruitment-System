const supabase = require("../config/supabase");

// Satu-satunya tempat query Supabase untuk tabel `companies`.

async function findByHrId(hrId) {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", hrId)
    .single();
  return data; // null kalau HR belum punya company
}

async function findFullByHrId(hrId) {
  const { data, error } = await supabase
    .from("companies")
    .select("*")
    .eq("hr_id", hrId)
    .single();
  return { data, error };
}

async function insert(hrId, payload) {
  const { data, error } = await supabase
    .from("companies")
    .insert([{ hr_id: hrId, ...payload }])
    .select()
    .single();
  return { data, error };
}

async function updateByHrId(hrId, payload) {
  const { data, error } = await supabase
    .from("companies")
    .update(payload)
    .eq("hr_id", hrId)
    .select()
    .single();
  return { data, error };
}

async function findAllWithJobs() {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, description, company_size, logo_url, jobs(id, title, location, skills, is_active)");
  return { data, error };
}

async function findPublicById(id) {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, description, company_size, logo_url")
    .eq("id", id)
    .single();
  return { data, error };
}

module.exports = { findByHrId, findFullByHrId, insert, updateByHrId, findAllWithJobs, findPublicById };
