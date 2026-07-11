const supabase = require("../config/supabase");

// FIX: kebocoran data antar-company. getTopCandidatesByPosition() dan
// searchCandidates() sebelumnya query LANGSUNG ke `resume_analysis` tanpa
// scoping company sama sekali — beda dengan controller lain
// (applicationController.getHRApplications, interviewController.getHRInterviews,
// dst) yang SELALU mulai dari "ambil company milik req.user.id dulu, baru
// filter ke job_id company itu". Akibatnya HR company A yang chat ke AI
// assistant bisa melihat data kandidat company B, C, dst — semua tenant di
// platform, karena backend connect ke Supabase pakai service_role key yang
// bypass RLS sepenuhnya (lihat config/supabase.js), jadi tidak ada proteksi
// lain selain scoping manual di query ini.
//
// getOwnedJobIds() menerapkan pola yang sama seperti controller lain: company
// -> jobs milik company itu -> daftar job_id yang boleh diakses. Kedua fungsi
// publik sekarang WAJIB menerima `hrId` dan memfilter lewat job_id ini.
async function getOwnedJobIds(hrId) {
  if (!hrId) return [];

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", hrId)
    .single();

  if (!company) return [];

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("company_id", company.id);

  return (jobs || []).map((j) => j.id);
}

/**
 * @param {string} hrId - req.user.id milik HR yang login (WAJIB — tanpa ini
 *   fungsi return {} kosong, bukan fallback ke "semua data").
 */
async function getTopCandidatesByPosition(hrId) {
  try {
    const jobIds = await getOwnedJobIds(hrId);
    if (jobIds.length === 0) return {};

    const { data: applications } = await supabase
      .from("applications")
      .select("id")
      .in("job_id", jobIds);

    const appIds = (applications || []).map((a) => a.id);
    if (appIds.length === 0) return {};

    const { data, error } = await supabase
      .from("resume_analysis")
      .select(
        `
        overall_score,
        ats_score,
        resume_score,
        extracted_skills,
        applications (
          candidate_id,
          job_id,
          jobs (
            title
          ),
          users:candidate_id (
            id,
            full_name,
            email
          )
        )
      `
      )
      // FIX: filter utama — sebelumnya tidak ada baris ini sama sekali.
      .in("application_id", appIds)
      .order("overall_score", { ascending: false })
      .limit(100);

    if (error) {
      console.error("getTopCandidatesByPosition error:", error.message);
      return {};
    }

    // Group by job title, ambil top 3 per posisi
    const grouped = {};
    for (const row of data || []) {
      const jobTitle = row.applications?.jobs?.title;
      if (!jobTitle) continue;

      if (!grouped[jobTitle]) grouped[jobTitle] = [];
      if (grouped[jobTitle].length >= 3) continue;

      const skills = row.extracted_skills || [];
      const skillNames = skills.map((s) =>
        typeof s === "object" ? s.name : s
      );

      grouped[jobTitle].push({
        name:
          row.applications?.users?.full_name ||
          row.applications?.users?.email ||
          "Unknown",
        email: row.applications?.users?.email,
        overall_score: row.overall_score ?? 0,
        ats_score: row.ats_score ?? 0,
        resume_score: row.resume_score ?? 0,
        skills: skillNames.slice(0, 6),
      });
    }

    return grouped;
  } catch (err) {
    console.error("getTopCandidatesByPosition error:", err.message);
    return {};
  }
}

/**
 * Cari kandidat yang relevan berdasarkan keyword dari pesan HR
 * @param {string} userMessage
 * @param {string} hrId - req.user.id milik HR yang login (WAJIB).
 */
async function searchCandidates(userMessage, hrId) {
  try {
    const jobIds = await getOwnedJobIds(hrId);
    if (jobIds.length === 0) return [];

    const { data: applications } = await supabase
      .from("applications")
      .select("id")
      .in("job_id", jobIds);

    const appIds = (applications || []).map((a) => a.id);
    if (appIds.length === 0) return [];

    const { data, error } = await supabase
      .from("resume_analysis")
      .select(
        `
        overall_score,
        ats_score,
        matching_score,
        extracted_skills,
        applications (
          candidate_id,
          jobs (
            title
          ),
          users:candidate_id (
            id,
            full_name,
            email
          )
        )
      `
      )
      // FIX: filter utama — sebelumnya tidak ada baris ini sama sekali.
      .in("application_id", appIds)
      .order("overall_score", { ascending: false })
      .limit(50);

    if (error) {
      console.error("searchCandidates error:", error.message);
      return [];
    }

    // Filter di sisi JS berdasarkan keyword dari pesan user
    const keywords = userMessage
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const results = (data || []).filter((row) => {
      const skills = (row.extracted_skills || []).map((s) =>
        (typeof s === "object" ? s.name : s).toLowerCase()
      );
      const jobTitle = (row.applications?.jobs?.title || "").toLowerCase();
      const candidateName = (
        row.applications?.users?.full_name || ""
      ).toLowerCase();

      return keywords.some(
        (k) =>
          jobTitle.includes(k) ||
          candidateName.includes(k) ||
          skills.some((s) => s.includes(k))
      );
    });

    return results.slice(0, 8).map((row) => {
      const skills = (row.extracted_skills || []).map((s) =>
        typeof s === "object" ? s.name : s
      );
      return {
        name:
          row.applications?.users?.full_name ||
          row.applications?.users?.email ||
          "Unknown",
        job_title: row.applications?.jobs?.title || "—",
        overall_score: row.overall_score ?? 0,
        ats_score: row.ats_score ?? 0,
        matching_score: row.matching_score ?? 0,
        skills: skills.slice(0, 6),
      };
    });
  } catch (err) {
    console.error("searchCandidates error:", err.message);
    return [];
  }
}

module.exports = { getTopCandidatesByPosition, searchCandidates };