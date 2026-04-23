const router = require("express").Router();
const {
  getMyNotifications,
  markAllRead,
  markOneRead,
} = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getMyNotifications);
router.put("/read-all", authMiddleware, markAllRead);
router.put("/:id/read", authMiddleware, markOneRead);

module.exports = router;
