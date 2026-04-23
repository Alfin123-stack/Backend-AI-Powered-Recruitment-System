const supabase = require("../config/supabase");

// ── GET notifikasi milik user yang login ───────────────────
exports.getMyNotifications = async (req, res) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", req.user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
};

// ── MARK ALL READ ──────────────────────────────────────────
exports.markAllRead = async (req, res) => {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", req.user.id)
    .eq("read", false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};

// ── MARK SINGLE READ ───────────────────────────────────────
exports.markOneRead = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};

// ── DELETE SINGLE NOTIFICATION ─────────────────────────────
exports.deleteNotification = async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("id", id)
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};

// ── DELETE ALL NOTIFICATIONS ───────────────────────────────
exports.deleteAllNotifications = async (req, res) => {
  const { error } = await supabase
    .from("notifications")
    .delete()
    .eq("user_id", req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
};

// ── GET UNREAD COUNT ───────────────────────────────────────
exports.getUnreadCount = async (req, res) => {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", req.user.id)
    .eq("read", false);

  if (error) return res.status(500).json({ error: error.message });
  res.json({ count: count || 0 });
};

// ── Helper: buat notifikasi (dipanggil dari controller lain) ─
exports.createNotification = async (userId, type, title, message) => {
  const { error } = await supabase
    .from("notifications")
    .insert([{ user_id: userId, type, title, message }]);

  if (error) console.error("❌ createNotification gagal:", error.message);
};
