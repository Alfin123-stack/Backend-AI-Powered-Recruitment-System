const router = require("express").Router();
const { chat } = require("../controllers/chatController");
const authMiddleware = require("../middleware/authMiddleware");

// POST /api/chat
// Body: { message: string, conversationHistory: [{role: 'user'|'assistant', content: string}] }
router.post("/", authMiddleware, chat);

module.exports = router;
