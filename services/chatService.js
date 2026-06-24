const { GoogleGenerativeAI } = require("@google/generative-ai");
const { findRelevantKnowledge } = require("./knowledgeService");
const {
  getTopCandidatesByPosition,
  searchCandidates,
} = require("./candidateService");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

/**
 * Deteksi intent dari pesan user
 * @param {string} message
 * @returns {'top_by_position' | 'search_candidates' | 'general'}
 */
function detectIntent(message) {
  const msg = message.toLowerCase();

  // Intent: minta top kandidat per posisi
  if (
    /(top|terbaik|ranking|kandidat).*(posisi|jabatan|semua|masing)|(posisi|jabatan).*(top|terbaik|kandidat)|(daftar|tampilkan|lihat).*(kandidat|pelamar)/i.test(
      msg
    )
  ) {
    return "top_by_position";
  }

  // Intent: cari kandidat spesifik
  if (
    /(cari|rekomendasikan|siapa|temukan|suggest).*(kandidat|pelamar|orang)/i.test(
      msg
    ) ||
    /(kandidat|pelamar).*(untuk|yang|dengan|punya)/i.test(msg)
  ) {
    return "search_candidates";
  }

  return "general";
}

/**
 * Proses pesan chatbot
 * @param {string} userMessage
 * @param {'hr' | 'candidate'} role
 * @param {Array} conversationHistory - array of {role: 'user'|'assistant', content: string}
 * @returns {Promise<string>}
 */
async function processChat(userMessage, role, conversationHistory = []) {
  // Query knowledge base relevan
  const knowledge = await findRelevantKnowledge(userMessage, role);

  // Bangun system context
  let systemContext = `Kamu adalah asisten AI untuk platform AI Resume Analyzer.
Jawab dalam Bahasa Indonesia yang ramah, singkat, dan profesional.
Jika ada data dari database, gunakan sebagai acuan utama jawaban kamu.
Jangan mengarang data — jika data tidak tersedia, sampaikan dengan jujur dan tawarkan bantuan lain.
Role user saat ini: ${role === "hr" ? "HR / Recruiter" : "Kandidat / Pencari Kerja"}.`;

  // Inject knowledge base jika ada
  if (knowledge.length > 0) {
    systemContext += `\n\n## Informasi Platform:\n`;
    systemContext += knowledge
      .map((k) => `Q: ${k.question}\nA: ${k.answer}`)
      .join("\n\n");
  }

  // Inject data kandidat jika role HR
  if (role === "hr") {
    const intent = detectIntent(userMessage);

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
        systemContext += `\n\n## Info: Belum ada data kandidat yang tersedia di database saat ini.\n`;
      }
    } else if (intent === "search_candidates") {
      const results = await searchCandidates(userMessage);

      if (results.length > 0) {
        systemContext += `\n\n## Kandidat Relevan (dari database):\n`;
        results.forEach((c, i) => {
          systemContext += `${i + 1}. ${c.name} — Posisi: ${c.job_title} | Overall: ${c.overall_score} | Skills: ${c.skills.join(", ") || "—"}\n`;
        });
      } else {
        systemContext += `\n\n## Info: Tidak ditemukan kandidat yang cocok dengan kriteria tersebut di database.\n`;
      }
    }
  }

  // Convert history ke format Gemini
  // Gemini pakai role 'user' dan 'model' (bukan 'assistant')
  const history = conversationHistory
    .slice(-10) // batasi 10 pesan terakhir agar tidak overload
    .map((msg) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemContext,
  });

  const chat = model.startChat({ history });
  const result = await chat.sendMessage(userMessage);
  return result.response.text();
}

module.exports = { processChat };
