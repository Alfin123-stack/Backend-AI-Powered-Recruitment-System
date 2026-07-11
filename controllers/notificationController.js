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
// FIX: sebelumnya cuma menerima (userId, type, title, message) — parameter
// `metadata` yang mulai dikirim dari applicationController.js (fix
// duplikasi notifikasi offer/reject) diam-diam diabaikan karena JS tidak
// error kalau argumen ekstra tidak dipakai. Akibatnya application_id/
// job_title/offer_status di notifikasi "status_update" (review,
// shortlisted, rejected via notifMap, serta accepted/declined di
// updateOfferStatus) tidak pernah tersimpan — beda dengan notifikasi
// offer_letter/rejection yang dibuat lewat createNotificationFromClient
// di bawah, yang memang sudah menyimpan metadata dari awal.
//
// `metadata = {}` dibuat default supaya semua pemanggilan lama yang masih
// pakai 4 argumen tetap jalan tanpa error.
exports.createNotification = async (userId, type, title, message, metadata = {}) => {
  const { error } = await supabase
    .from("notifications")
    .insert([{ user_id: userId, type, title, message, metadata }]);

  if (error) console.error("❌ createNotification gagal:", error.message);
};

// ── CREATE NOTIFICATION FROM CLIENT (Next.js server actions) ─
// Dipakai oleh sendOfferLetterAction & sendRejectionAction (route ini
// sebelumnya tidak ada sama sekali — POST /api/notifications 404).
//
// Target user (kandidat) SENGAJA tidak diambil dari body request,
// melainkan diturunkan dari application_id di server, lalu divalidasi
// bahwa req.user (HR) memang pemilik job/company dari application
// tersebut. Ini mencegah request ini dipakai mengirim notifikasi ke
// user sembarangan hanya dengan menebak/mengirim user_id.
exports.createNotificationFromClient = async (req, res) => {
  try {
    const { type, title, message, application_id, metadata } = req.body;

    const validTypes = [
      "status_update",
      "interview",
      "general",
      "offer_letter",
      "rejection",
    ];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "type tidak valid" });
    }
    if (!title || !message) {
      return res.status(400).json({ error: "title dan message wajib diisi" });
    }
    if (!application_id) {
      return res.status(400).json({ error: "application_id wajib diisi" });
    }

    const { data: app, error: appError } = await supabase
      .from("applications")
      .select("candidate_id, jobs(company_id)")
      .eq("id", application_id)
      .single();

    if (appError || !app) {
      return res.status(404).json({ error: "Lamaran tidak ditemukan" });
    }

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company || app.jobs?.company_id !== company.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // application_id selalu dipaksa masuk ke metadata di sini juga
    // (bukan cuma kolom top-level) — supaya OfferNotifCard.tsx yang
    // baca `notif.metadata.application_id` tetap aman walau frontend
    // lupa menyertakannya.
    const mergedMetadata = { ...(metadata || {}), application_id };

    const { data, error } = await supabase
      .from("notifications")
      .insert([
        {
          user_id: app.candidate_id,
          type,
          title,
          message,
          application_id,
          metadata: mergedMetadata,
        },
      ])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};