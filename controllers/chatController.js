const { processChat } = require("../services/chatService");

exports.chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({ error: "Message tidak boleh kosong" });
    }

    const role = req.user.role; // 'hr' | 'candidate' — dari authMiddleware

    const reply = await processChat(message, role, conversationHistory);

    res.json({ reply });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Gagal memproses pesan, coba lagi" });
  }
};
