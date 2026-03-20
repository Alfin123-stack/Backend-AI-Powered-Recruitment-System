const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);

async function analyzeResume(cvText, jobDescription) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `
Kamu adalah AI HR analyst. Analisis CV berikut secara mendalam.
Kembalikan HANYA JSON valid, tanpa teks tambahan, tanpa markdown, tanpa backtick.

CV:
${cvText}

${jobDescription ? `Job Description:\n${jobDescription}` : ""}

Format JSON yang harus dikembalikan:
{
  "resumeScore": <number 0-100, kualitas keseluruhan CV>,
  "matchingScore": <number 0-100, kecocokan dengan job desc, 50 jika tidak ada job desc>,
  "atsScore": <number 0-100, seberapa ATS-friendly CV ini>,
  "overallScore": <number 0-100, rata-rata keseluruhan>,
  "skills": [
    { "name": "<nama skill>", "level": <number 0-100> }
  ],
  "categories": [
    { "label": "Struktur CV", "score": <number 0-100> },
    { "label": "Relevansi Skill", "score": <number 0-100> },
    { "label": "Pengalaman Kerja", "score": <number 0-100> },
    { "label": "Pendidikan", "score": <number 0-100> },
    { "label": "ATS Compatibility", "score": <number 0-100> }
  ],
  "strengths": [
    "<kalimat kekuatan CV dalam bahasa Indonesia>"
  ],
  "improvements": [
    "<kalimat saran perbaikan CV dalam bahasa Indonesia>"
  ]
}
`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();

  // Bersihkan kalau Gemini tetap wrap dengan backtick
  const cleaned = raw.replace(/```json|```/g, "").trim();

  return JSON.parse(cleaned);
}

module.exports = analyzeResume;
