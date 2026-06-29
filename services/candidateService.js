const supabase = require("../config/supabase");

async function getTopCandidatesByPosition() {
  try {
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
 */
async function searchCandidates(userMessage) {
  try {
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
