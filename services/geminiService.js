const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

async function analyzeResume(cvText) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Kamu adalah AI HR analyst profesional. Analisis CV berikut secara mendalam dan jujur.
Kembalikan HANYA JSON valid, tanpa teks tambahan, tanpa markdown, tanpa backtick.

CV:
${cvText}

Format JSON yang harus dikembalikan (semua field wajib ada):
{
  "resumeScore": <number 0-100, kualitas keseluruhan konten CV>,
  "atsScore": <number 0-100, seberapa ATS-friendly CV ini>,
  "overallScore": <number 0-100, rata-rata gabungan semua dimensi>,
  "impactScore": <number 0-100, kekuatan bahasa dan pencapaian kuantitatif di CV>,
  "readabilityScore": <number 0-100, keterbacaan dan struktur penulisan CV>,
  "experienceLevel": "<Junior / Mid-level / Senior — deteksi dari CV>",
  "jobTitle": "<estimasi role/jabatan berdasarkan isi CV>",
  "aiSummary": "<paragraf ringkas 2-3 kalimat dalam bahasa Indonesia tentang kualitas CV ini>",
  "skills": [
    { "name": "<nama skill atau tool yang tersebut di CV>", "level": <number 0-100> }
  ],
  "categories": [
    { "label": "Struktur CV", "score": <number 0-100>, "feedback": "<1 kalimat singkat feedback dalam bahasa Indonesia>" },
    { "label": "Relevansi Skill", "score": <number 0-100>, "feedback": "<1 kalimat singkat>" },
    { "label": "Pengalaman Kerja", "score": <number 0-100>, "feedback": "<1 kalimat singkat>" },
    { "label": "Pendidikan", "score": <number 0-100>, "feedback": "<1 kalimat singkat>" },
    { "label": "ATS Compatibility", "score": <number 0-100>, "feedback": "<1 kalimat singkat>" }
  ],
  "strengths": [
    "<kalimat kekuatan CV dalam bahasa Indonesia — spesifik, bukan generik>"
  ],
  "improvements": [
    "<kalimat saran perbaikan CV dalam bahasa Indonesia — spesifik dan actionable>"
  ],
  "atsChecks": [
    { "label": "Format file PDF terdeteksi", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Heading standar tersedia (Experience, Education, Skills)", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Tidak ada tabel atau kolom kompleks", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Professional summary tersedia", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Keyword role relevan terdeteksi", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Tanggal pekerjaan konsisten", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Link aktif (LinkedIn / GitHub / Portfolio)", "ok": <true/false>, "tip": "<saran singkat jika false>" },
    { "label": "Tidak ada header atau footer tersembunyi", "ok": <true/false>, "tip": "<saran singkat jika false>" }
  ],
  "lineFeedback": [
    {
      "section": "<nama section CV: Experience / Skills / Education / Summary / Projects>",
      "line": "<kutip kalimat atau frasa asli dari CV yang dikomentari, maks 60 karakter>",
      "type": "<good | warn | bad>",
      "tip": "<saran spesifik dalam bahasa Indonesia, actionable>"
    }
  ],
  "writingSuggestions": [
    {
      "section": "<nama section>",
      "original": "<kalimat asli dari CV yang lemah>",
      "improved": "<versi yang diperkuat dengan kata kerja aktif, angka, dan dampak konkret — dalam bahasa Indonesia atau campuran sesuai konteks CV>",
      "reason": "<1-2 kalimat penjelasan mengapa versi baru lebih baik, dalam bahasa Indonesia>"
    }
  ]
}

Panduan penting:
- lineFeedback: berikan 5-8 item, campuran good/warn/bad, dari berbagai section yang ada di CV
- writingSuggestions: berikan 3-5 item, fokus pada kalimat yang paling lemah atau paling bisa diperkuat
- Semua saran harus SPESIFIK berdasarkan isi CV yang diberikan, bukan generik
- Jika CV dalam bahasa Indonesia, semua output dalam bahasa Indonesia
- Jika CV dalam bahasa Inggris, improved di writingSuggestions boleh dalam bahasa Inggris
- atsChecks.ok untuk "Format file PDF": set true karena kita sudah ekstrak dari PDF
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const cleaned = raw.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

module.exports = analyzeResume;
