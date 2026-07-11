const router = require("express").Router();
const {
  getMyNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  deleteAllNotifications,
  getUnreadCount,
  createNotificationFromClient,
} = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, getMyNotifications);
router.get("/unread-count", authMiddleware, getUnreadCount);
router.put("/read-all", authMiddleware, markAllRead);
router.put("/:id/read", authMiddleware, markOneRead);
router.delete("/all", authMiddleware, deleteAllNotifications);
router.delete("/:id", authMiddleware, deleteNotification);
router.post("/", authMiddleware, createNotificationFromClient);

module.exports = router;