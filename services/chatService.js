const { GoogleGenerativeAI } = require("@google/generative-ai");
const { findRelevantKnowledge } = require("./knowledgeService");
const { getTopCandidatesByPosition, searchCandidates } = require("./candidateService");
const { getMatchedJobsForCandidate } = require("./candidateInfoService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

// Fallback chain: coba model pertama, kalau 429 otomatis ke berikutnya
const MODELS = ["gemini-2.5-flash", "gemini-1.5-flash"];

// ── Intent detection ──────────────────────────────────────────────────────────

function detectHRIntent(message) {
  const msg = message.toLowerCase();
  if (
    /(top|terbaik|ranking|kandidat).*(posisi|jabatan|semua|masing)|(posisi|jabatan).*(top|terbaik|kandidat)|(daftar|tampilkan|lihat).*(kandidat|pelamar)/i.test(msg)
  ) return "top_by_position";

  if (
    /(cari|rekomendasikan|siapa|temukan).*(kandidat|pelamar|orang)/i.test(msg) ||
    /(kandidat|pelamar).*(untuk|yang|dengan|punya)/i.test(msg)
  ) return "search_candidates";

  return "general";
}

function detectCandidateIntent(message) {
  const msg = message.toLowerCase();

  if (
    /(posisi|lowongan|jobs?|pekerjaan).*(ada|tersedia|tersedia|apa|mana|daftar|list|tampilkan|semua)/i.test(msg) ||
    /(ada|tampilkan|cari|lihat).*(posisi|lowongan|jobs?|pekerjaan)/i.test(msg) ||
    /(cocok|sesuai|rekomendasikan?|match).*(posisi|lowongan|jobs?|pekerjaan|cv|saya)/i.test(msg) ||
    /(posisi|lowongan|pekerjaan).*(cocok|sesuai|match|rekomendasikan?)/i.test(msg)
  ) return "job_match";

  if (
    /(cv|resume|analisis|skor|score|hasil).*(saya|ku|aku|ku)/i.test(msg) ||
    /(skor|score|nilai|hasil|kualitas).*(cv|resume|analisis)/i.test(msg) ||
    /cv.*(saya|baik|bagus|jelek|kuat|lemah)/i.test(msg) ||
    /(kekuatan|kelemahan|saran|perbaiki).*(cv|resume)/i.test(msg)
  ) return "cv_info";

  return "general";
}

// ── Main processChat ──────────────────────────────────────────────────────────

/**
 * @param {string} userMessage
 * @param {'hr' | 'candidate'} role
 * @param {Array<{role: string, content: string}>} conversationHistory
 * @param {string} userId
 */
async function processChat(userMessage, role, conversationHistory = [], userId = null) {
  const knowledge = await findRelevantKnowledge(userMessage, role);

  // ── System context ────────────────────────────────────────────────────────
  let systemContext = `Kamu adalah asisten AI untuk platform AI Resume Analyzer.
Jawab dalam Bahasa Indonesia yang ramah, singkat, dan profesional.
Jika ada data dari database, gunakan sebagai acuan utama jawaban kamu.
Jangan mengarang data — jika data tidak tersedia, sampaikan dengan jujur dan tawarkan bantuan lain.
Role user saat ini: ${role === "hr" ? "HR / Recruiter" : "Kandidat / Pencari Kerja"}.`;

  // ── Inject knowledge base ─────────────────────────────────────────────────
  if (knowledge.length > 0) {
    systemContext += `\n\n## Informasi Platform:\n`;
    systemContext += knowledge.map((k) => `Q: ${k.question}\nA: ${k.answer}`).join("\n\n");
  }

  // ── Context khusus HR ─────────────────────────────────────────────────────
  if (role === "hr") {
    const intent = detectHRIntent(userMessage);

    if (intent === "top_by_position") {
      const grouped = await getTopCandidatesByPosition();
      const positions = Object.keys(grouped);

      if (positions.length > 0) {
        systemContext += `\n\n## Data Top Kandidat Per Posisi (real-time dari database):\n`;
        for (const position of positions) {
          systemContext += `\nPosisi: **${position}**\n`;
          grouped[position].forEach((c, i) => {
            systemContext += `  ${i + 1}. ${c.name} — Overall: ${c.overall_score} | ATS: ${c.ats_score} | Skills: ${c.skills.join(", ") || "—"}\n`;
          });
        }
      } else {
        systemContext += `\n\n## Info: Belum ada data kandidat di database saat ini.\n`;
      }
    }

    if (intent === "search_candidates") {
      const results = await searchCandidates(userMessage);
      if (results.length > 0) {
        systemContext += `\n\n## Kandidat Relevan (dari database):\n`;
        results.forEach((c, i) => {
          systemContext += `${i + 1}. ${c.name} — Posisi: ${c.job_title} | Overall: ${c.overall_score} | Skills: ${c.skills.join(", ") || "—"}\n`;
        });
      } else {
        systemContext += `\n\n## Info: Tidak ditemukan kandidat yang cocok dengan kriteria tersebut.\n`;
      }
    }
  }

  // ── Context khusus Kandidat ───────────────────────────────────────────────
  if (role === "candidate" && userId) {
    const intent = detectCandidateIntent(userMessage);

    if (intent === "job_match" || intent === "cv_info") {
      const { cv, matchedJobs, allJobs } = await getMatchedJobsForCandidate(userId, userMessage);

      if (cv) {
        const skills = (cv.extracted_skills || []).map((s) =>
          typeof s === "object" ? s.name : s
        );
        systemContext += `\n\n## Data CV Kandidat (dari database):\n`;
        systemContext += `- Job Title Terdeteksi: ${cv.job_title || "—"}\n`;
        systemContext += `- Level Pengalaman: ${cv.experience_level || "—"}\n`;
        systemContext += `- Overall Score: ${cv.overall_score ?? "—"} | ATS Score: ${cv.ats_score ?? "—"} | Resume Score: ${cv.resume_score ?? "—"}\n`;
        systemContext += `- Skills: ${skills.slice(0, 10).join(", ") || "—"}\n`;
        if (cv.ai_summary) systemContext += `- Ringkasan AI: ${cv.ai_summary}\n`;
        if (cv.strengths?.length) systemContext += `- Kekuatan: ${cv.strengths.slice(0, 3).join("; ")}\n`;
        if (cv.improvements?.length) systemContext += `- Area perbaikan: ${cv.improvements.slice(0, 3).join("; ")}\n`;
      } else {
        systemContext += `\n\n## Info: Kandidat belum memiliki data CV yang dianalisis. Sarankan untuk upload dan analisis CV terlebih dahulu di halaman Analyze.\n`;
      }

      if (intent === "job_match") {
        if (matchedJobs.length > 0) {
          systemContext += `\n\n## Lowongan yang Tersedia & Tingkat Kecocokan dengan CV:\n`;
          matchedJobs.forEach((j, i) => {
            systemContext += `${i + 1}. **${j.title}** di ${j.company}\n`;
            systemContext += `   - Match Score: ${j.match_score}% | Tipe: ${j.type} | Lokasi: ${j.location}\n`;
            if (j.salary) systemContext += `   - Gaji: ${j.salary}\n`;
            if (j.required_skills?.length) systemContext += `   - Skills dibutuhkan: ${j.required_skills.slice(0, 5).join(", ")}\n`;
          });
        } else if (allJobs.length > 0) {
          systemContext += `\n\n## Lowongan yang Tersedia (${allJobs.length} posisi):\n`;
          allJobs.slice(0, 8).forEach((j, i) => {
            systemContext += `${i + 1}. ${j.title} di ${j.companies?.name ?? "—"} (${j.location ?? "—"}, ${j.type ?? "—"})\n`;
          });
        } else {
          systemContext += `\n\n## Info: Belum ada lowongan aktif saat ini.\n`;
        }
      }
    }
  }

  // ── Kirim ke Gemini dengan fallback chain ─────────────────────────────────
  const history = conversationHistory
    .slice(-10)
    .map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  let lastErr = null;

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemContext,
        generationConfig: {
          maxOutputTokens: 512,
          temperature: 0.7,
        },
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(userMessage);
      return result.response.text();

    } catch (err) {
      const is429 = err.status === 429 || err?.message?.includes("429");

      if (is429) {
        console.warn(`[chatService] Rate limit on ${modelName}, trying next model...`);
        lastErr = err;
        continue; // coba model berikutnya
      }

      // Error bukan 429 — langsung lempar
      console.error(`[chatService] Gemini error (${modelName}):`, err.message);
      throw err;
    }
  }

  // Semua model kena rate limit
  console.warn("[chatService] All models rate limited:", lastErr?.message);
  return "Maaf, asisten sedang sibuk. Mohon tunggu beberapa detik lalu coba lagi. 🙏";
}

module.exports = { processChat };