const analyzeResume = require("../services/geminiService");

exports.analyze = async (req, res) => {
  try {
    const { text, jobDescription } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Teks CV tidak ditemukan" });
    }

    const result = await analyzeResume(text, jobDescription);
    res.json(result);
  } catch (err) {
    console.error("Gemini error:", err.message);
    res.status(500).json({ error: "Analisis gagal, coba lagi" });
  }
};
