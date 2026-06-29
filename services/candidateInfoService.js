const supabase = require("../config/supabase");

/**
 * Ambil CV analysis terbaru milik kandidat
 * @param {string} userId
 */
async function getCandidateCvAnalysis(userId) {
  try {
    const { data, error } = await supabase
      .from("cv_analysis")
      .select(
        "overall_score, ats_score, resume_score, extracted_skills, job_title, experience_level, ai_summary, strengths, improvements"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("getCandidateCvAnalysis error:", error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.error("getCandidateCvAnalysis error:", err.message);
    return null;
  }
}

/**
 * Ambil semua job aktif beserta info perusahaan
 */
async function getActiveJobs() {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        "id, title, skills, location, type, salary, deadline, companies(name)"
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("getActiveJobs error:", error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error("getActiveJobs error:", err.message);
    return [];
  }
}

/**
 * Hitung match score antara skill kandidat dan skill yang dibutuhkan job
 * Return 0-100
 * @param {string[]} candidateSkills
 * @param {string[]} jobSkills
 */
function calcMatchScore(candidateSkills, jobSkills) {
  if (!jobSkills?.length) return 0;
  const candidate = candidateSkills.map((s) => s.toLowerCase());
  const matched = jobSkills.filter((js) =>
    candidate.some((cs) => cs.includes(js.toLowerCase()) || js.toLowerCase().includes(cs))
  );
  return Math.round((matched.length / jobSkills.length) * 100);
}

/**
 * Ambil job yang cocok dengan CV kandidat, sorted by match score
 * @param {string} userId
 * @param {string} userMessage - untuk filter keyword jika user tanya posisi spesifik
 */
async function getMatchedJobsForCandidate(userId, userMessage = "") {
  const [cv, jobs] = await Promise.all([
    getCandidateCvAnalysis(userId),
    getActiveJobs(),
  ]);

  if (!cv) return { cv: null, matchedJobs: [], allJobs: jobs };

  // Ekstrak nama skill dari format {name, level}
  const candidateSkills = (cv.extracted_skills || []).map((s) =>
    typeof s === "object" ? s.name : s
  );

  // Hitung match score tiap job
  let matchedJobs = jobs.map((job) => ({
    title: job.title,
    company: job.companies?.name ?? "—",
    location: job.location ?? "—",
    type: job.type ?? "—",
    salary: job.salary ?? null,
    deadline: job.deadline ?? null,
    required_skills: job.skills || [],
    match_score: calcMatchScore(candidateSkills, job.skills || []),
  }));

  // Filter keyword jika user tanya posisi tertentu
  const keywords = userMessage
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (keywords.length > 0) {
    const filtered = matchedJobs.filter((j) =>
      keywords.some(
        (k) =>
          j.title.toLowerCase().includes(k) ||
          j.required_skills.some((s) => s.toLowerCase().includes(k))
      )
    );
    // Kalau ada hasil filter, pakai itu — kalau tidak, tetap semua
    if (filtered.length > 0) matchedJobs = filtered;
  }

  // Sort by match score descending, ambil top 8
  matchedJobs = matchedJobs
    .sort((a, b) => b.match_score - a.match_score)
    .slice(0, 8);

  return { cv, matchedJobs, allJobs: jobs };
}

module.exports = { getMatchedJobsForCandidate, getCandidateCvAnalysis, getActiveJobs };
