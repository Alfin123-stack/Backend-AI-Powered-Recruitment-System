const supabase = require("../config/supabase");
const { createNotification } = require("./notificationController");

// ── Helper: pastikan HR yang login memang pemilik company dari
// application ini, sebelum boleh nulis/baca data sensitif ────
const getOwnedApplicationForHR = async (applicationId, hrId) => {
  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", hrId)
    .single();

  if (!company) return null;

  const { data: app } = await supabase
    .from("applications")
    .select("id, candidate_id, jobs(company_id)")
    .eq("id", applicationId)
    .single();

  if (!app || app.jobs?.company_id !== company.id) return null;

  return app;
};

// ── CREATE EVALUATION (HR only) ─────────────────────────────
exports.createEvaluation = async (req, res, next) => {
  if (req.user.role !== "hr") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { application_id, interview_id, score, recommendation, notes } = req.body;

  if (!application_id) {
    return res.status(400).json({ error: "application_id wajib diisi" });
  }

  const validRecommendations = ["hire", "reject", "consider"];
  if (!validRecommendations.includes(recommendation)) {
    return res.status(400).json({ error: "recommendation tidak valid" });
  }

  const scoreNum = Number(score);
  if (!Number.isInteger(scoreNum) || scoreNum < 1 || scoreNum > 10) {
    return res.status(400).json({ error: "score harus angka bulat 1-10" });
  }

  // FIX: pakai `app` (bukan re-query) untuk ambil candidate_id nanti saat
  // kirim notifikasi — getOwnedApplicationForHR sudah select candidate_id,
  // jadi tidak perlu query tambahan.
  const app = await getOwnedApplicationForHR(application_id, req.user.id);
  if (!app) return res.status(403).json({ error: "Forbidden" });

  // Kalau interview_id dikirim, pastikan interview itu memang punya
  // application yang sama — cegah cross-linking evaluasi ke interview
  // milik kandidat lain.
  if (interview_id) {
    const { data: interview } = await supabase
      .from("interviews")
      .select("id, application_id")
      .eq("id", interview_id)
      .single();

    if (!interview || interview.application_id !== application_id) {
      return res
        .status(400)
        .json({ error: "interview_id tidak sesuai dengan application_id" });
    }
  }

  const { data, error } = await supabase
    .from("evaluations")
    .insert([
      {
        application_id,
        interview_id: interview_id || null,
        evaluator_id: req.user.id,
        score: scoreNum,
        recommendation,
        notes: notes || null,
      },
    ])
    .select()
    .single();

  if (error) return next(error);

  // TAMBAHAN: notifikasi ke kandidat begitu evaluasi tersimpan — untuk
  // KETIGA rekomendasi sekarang, karena rejectionActions.ts sudah tidak
  // lagi kirim notifikasi manual sendiri (dipindah ke sini supaya backend
  // jadi satu-satunya sumber notifikasi evaluasi, sama seperti pola yang
  // dipakai untuk onboarding):
  //
  // - "hire"     → belum ada notif apapun ke kandidat sampai titik ini
  //                (status "evaluated" yang di-set setelahnya lewat
  //                PUT /status memang sengaja silent).
  // - "consider" → tidak ada notifikasi lain sama sekali untuk jalur ini.
  // - "reject"   → SEBELUMNYA dikirim oleh sendRejectionAction (Next.js
  //                action) sebagai notif terpisah + email. Sekarang email
  //                tetap dikirim dari sana, tapi notifikasi in-app-nya
  //                dipindah ke sini (pakai `notes` sebagai feedback, field
  //                yang sama persis yang dikirim useEvaluationFlow
  //                .handleReject ke sendRejectionAction sebagai
  //                `feedback: evaluation.notes`) — supaya tidak ada 2
  //                sumber notifikasi untuk 1 keputusan reject.
  //                rejectionActions.ts PUT /status masih pakai
  //                skipStatusNotification: true, karena notifMap.rejected
  //                di updateApplicationStatus TETAP harus di-skip (kalau
  //                tidak, tetap akan dobel dengan notif dari sini).
  //
  // FIX (wording): ketiga pesan sebelumnya cuma bilang "hasil sudah
  // keluar" / "sedang dipertimbangkan" tanpa kasih tahu kandidat HARUS
  // ke mana untuk lihat detailnya — dan pesan "reject" sebelumnya malah
  // bahasa Inggris sendiri, tidak konsisten dengan "hire"/"consider" yang
  // bahasa Indonesia. Sekarang ketiganya diseragamkan: bahasa Indonesia,
  // nada lebih hangat, dan selalu diarahkan ke halaman yang benar —
  // Applications → tab Interview → buka detail interview yang
  // bersangkutan untuk melihat hasil evaluasi lengkapnya (score, notes,
  // recommendation — lihat getEvaluationsByApplication di bawah, yang
  // memang sudah menyaring identitas evaluator dari sisi candidate).
  {
    const { data: jobDetail } = await supabase
      .from("applications")
      .select("jobs(title, companies(name))")
      .eq("id", application_id)
      .single();

    const jobTitle = jobDetail?.jobs?.title || "posisi ini";
    const companyName = jobDetail?.jobs?.companies?.name || "perusahaan ini";
    const evaluationDetailHint =
      "Buka halaman Applications, pilih tab Interview, lalu lihat detail interview ini untuk membaca hasil evaluasi lengkapnya.";

    const candidateNotifMap = {
      hire: {
        type: "status_update",
        title: "Kabar Baik dari Tim HR 🎉",
        message: `Hasil interview kamu untuk posisi ${jobTitle} sudah keluar. ${evaluationDetailHint} Tunggu kabar selanjutnya dari tim HR ya.`,
        metadata: { application_id, job_title: jobTitle },
      },
      consider: {
        type: "status_update",
        title: "Evaluasi Interview Selesai",
        message: `Interview kamu untuk posisi ${jobTitle} sudah selesai dievaluasi dan sedang dipertimbangkan lebih lanjut oleh tim HR. ${evaluationDetailHint}`,
        metadata: { application_id, job_title: jobTitle },
      },
      // FIX: title & message sebelumnya bahasa Inggris ("Application
      // Update — ...") — sekarang disamakan ke bahasa Indonesia dengan
      // nada yang tetap sopan dan suportif, plus arahan yang sama ke tab
      // Interview seperti 2 rekomendasi lainnya. `type: "rejection"`
      // TIDAK diubah — itu yang dipakai UI notifikasi untuk
      // styling/filtering, cuma isi title & message yang diperbarui.
      reject: {
        type: "rejection",
        title: `Update Lamaran — ${jobTitle}`,
        message: notes
          ? `Terima kasih sudah meluangkan waktu untuk interview di ${companyName}. Untuk saat ini, tim HR memutuskan melanjutkan dengan kandidat lain. Catatan dari HR: "${notes}". ${evaluationDetailHint}`
          : `Terima kasih sudah meluangkan waktu untuk interview posisi ${jobTitle} di ${companyName}. Untuk saat ini, tim HR memutuskan melanjutkan dengan kandidat lain. ${evaluationDetailHint}`,
        metadata: {
          application_id,
          job_title: jobTitle,
          company_name: companyName,
          feedback: notes || null,
        },
      },
    };

    const n = candidateNotifMap[recommendation];
    await createNotification(app.candidate_id, n.type, n.title, n.message, n.metadata);
  }

  res.status(201).json(data);
};

// ── GET EVALUATIONS BY APPLICATION (HR & candidate) ─────────
// HR (pemilik company job ini) lihat versi lengkap termasuk notes
// & nama evaluator. Candidate (pemilik application) lihat score,
// recommendation, notes, dan tanggal — tanpa nama evaluator
// (identitas internal HR tetap disembunyikan dari candidate).
exports.getEvaluationsByApplication = async (req, res, next) => {
  const { applicationId } = req.params;

  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, candidate_id, jobs(companies(hr_id))")
    .eq("id", applicationId)
    .single();

  if (appError || !app) {
    return res.status(404).json({ error: "Lamaran tidak ditemukan" });
  }

  const isOwnerHR =
    req.user.role === "hr" && app.jobs?.companies?.hr_id === req.user.id;
  const isOwnerCandidate = req.user.id === app.candidate_id;

  if (!isOwnerHR && !isOwnerCandidate) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase
    .from("evaluations")
    .select(
      "id, interview_id, evaluator_id, score, recommendation, notes, created_at, users(full_name)",
    )
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false });

  if (error) return next(error);

  if (isOwnerHR) {
    return res.json(
      data.map((e) => ({
        id: e.id,
        interview_id: e.interview_id,
        evaluator_name: e.users?.full_name || "—",
        score: e.score,
        recommendation: e.recommendation,
        notes: e.notes,
        created_at: e.created_at,
      })),
    );
  }

  // Candidate: full feedback minus identitas evaluator internal
  return res.json(
    data.map((e) => ({
      id: e.id,
      score: e.score,
      recommendation: e.recommendation,
      notes: e.notes,
      created_at: e.created_at,
    })),
  );
};