const { createClient } = require("@supabase/supabase-js");
const { verify } = require("../utils/offerToken");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Auth khusus untuk PUT /api/applications/:id/offer.
// Dua jalur masuk yang sah:
//   1. Kandidat sedang login di dashboard → Bearer token Supabase biasa
//      (dipakai tombol Accept/Decline di OfferNotifCard).
//      -> WAJIB diverifikasi bahwa user yang login adalah pemilik
//         application ini (candidate_id), bukan sekadar user valid.
//   2. Klik link dari email → belum tentu login → signed token HMAC
//      dikirim lewat body/query `token` (dipakai app/api/offer/[id]/*).
//      -> Sudah aman secara desain karena token di-scope ke
//         application_id lewat signature-nya (lihat utils/offerToken).
//
// req.offerAuthVia diisi "session" atau "token" supaya controller tahu
// jalur mana yang dipakai.
module.exports = async (req, res, next) => {
  const { id: applicationId } = req.params;

  if (!applicationId) {
    return res.status(400).json({ error: "Application ID diperlukan" });
  }

  const bearer = req.headers.authorization?.split(" ")[1];

  if (bearer) {
    try {
      const { data, error } = await supabase.auth.getUser(bearer);
      if (error || !data.user) {
        return res.status(401).json({ error: "Token tidak valid" });
      }

      const { data: profile, error: profileError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (profileError || !profile) {
        return res.status(404).json({ error: "User profile not found" });
      }

      // FIX: verifikasi kepemilikan application. Tanpa ini, siapapun yang
      // login (bahkan kandidat lain / HR) bisa accept/decline offer milik
      // orang lain hanya dengan mengganti :id di URL (IDOR).
      const { data: application, error: appError } = await supabase
        .from("applications")
        .select("id, candidate_id")
        .eq("id", applicationId)
        .single();

      if (appError || !application) {
        return res.status(404).json({ error: "Lamaran tidak ditemukan" });
      }

      if (application.candidate_id !== data.user.id) {
        return res
          .status(403)
          .json({ error: "Anda tidak memiliki akses ke lamaran ini" });
      }

      req.user = { ...data.user, ...profile };
      req.application = application;
      req.offerAuthVia = "session";
      return next();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  const token = req.body?.token || req.query?.token;
  if (token) {
    const result = verify(token, applicationId);

    if (!result.valid) {
      const messages = {
        expired: "Link offer ini sudah kedaluwarsa.",
        application_mismatch: "Token tidak cocok dengan lamaran ini.",
        bad_signature: "Token tidak valid atau sudah diubah.",
        bad_payload: "Token tidak valid.",
        malformed: "Token tidak valid.",
      };
      return res
        .status(401)
        .json({ error: messages[result.reason] || "Token tidak valid" });
    }

    req.offerAuthVia = "token";
    return next();
  }

  return res.status(401).json({ error: "Autentikasi diperlukan" });
};