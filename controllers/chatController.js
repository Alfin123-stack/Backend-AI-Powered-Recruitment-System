const { processChat } = require("../services/chatService");
const logger = require("../utils/logger");

exports.chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message tidak boleh kosong" });
    }

    // FIX (security/cost): batas panjang pesan -- cegah abuse ke Gemini API.
    if (message.length > 2000) {
      return res.status(400).json({ error: "Pesan terlalu panjang (maks 2.000 karakter)" });
    }

    const role = req.user.role;       // 'hr' | 'candidate'
    const userId = req.user.id;       // dipakai untuk query CV kandidat

    const reply = await processChat(message, role, conversationHistory, userId);

    res.json({ reply });
  } catch (err) {
    logger.error({ err }, "Chat processing error");
    res.status(500).json({ error: "Gagal memproses pesan, coba lagi" });
  }
};