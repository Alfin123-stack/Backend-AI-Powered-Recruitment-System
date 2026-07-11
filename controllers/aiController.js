const analyzeResume = require("../services/geminiService");
const logger = require("../utils/logger");

exports.analyze = async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: "Teks CV tidak ditemukan" });
    }

    // FIX (security/cost): batas panjang input -- cegah teks raksasa yang
    // membebani Gemini API (biaya + performa).
    if (text.length > 15000) {
      return res.status(400).json({ error: "Teks CV terlalu panjang (maks 15.000 karakter)" });
    }

    const result = await analyzeResume(text);
    res.json(result);
  } catch (err) {
    logger.error({ err }, "Gemini analyze error");
    res.status(500).json({ error: "Analisis gagal, coba lagi" });
  }
};
