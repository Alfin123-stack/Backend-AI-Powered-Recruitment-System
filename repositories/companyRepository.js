const supabase = require("../config/supabase");

// Satu-satunya tempat query Supabase untuk tabel `companies` yang dipakai
// domain applications. (companyController.js masih punya query sendiri
// untuk kebutuhan domain company itu sendiri -- tidak diubah di sini,
// supaya scope refactor tetap fokus ke domain applications dulu.)

async function findByHrId(hrId) {
  const { data } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", hrId)
    .single();
  return data; // null kalau HR belum punya company
}

module.exports = { findByHrId };
