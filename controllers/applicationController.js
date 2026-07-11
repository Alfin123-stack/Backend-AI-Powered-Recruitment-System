const { createNotification } = require("./notificationController");
const supabase = require("../config/supabase");
const logger = require("../utils/logger");
const { sign } = require("../utils/offerToken");

// ── GET HR APPLICATIONS ────────────────────────────────────
exports.getHRApplications = async (req, res, next) => {
  const { data: company, error: companyError } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", req.user.id)
    .single();

  if (companyError || !company) return res.json([]);

  const { data: jobs } = await supabase
    .from("jobs")
    .select("id")
    .eq("company_id", company.id);

  if (!jobs || jobs.length === 0) return res.json([]);

  const jobIds = jobs.map((j) => j.id);

  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, offer_status, offer_expires_at, onboarding_sent, cv_url, created_at, candidate_id, job_id,
      jobs(id, title, companies(name)),
      resume_analysis(resume_score, matching_score, extracted_skills)
    `,
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) return next(error);

  const candidateIds = [...new Set(data.map((a) => a.candidate_id))];
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", candidateIds);

  const userMap = {};
  (users || []).forEach((u) => {
    userMap[u.id] = u;
  });

  const result = data.map((a) => ({
    id: a.id,
    status: a.status,
    // offer_status & onboarding_sent — dibutuhkan frontend untuk
    // menampilkan tombol "Kirim Onboarding Email" hanya saat offer_status
    // === "accepted"/status "hired", dan mengganti label tombol jadi
    // "Sudah Dikirim" kalau onboarding_sent sudah true (lihat
    // updateOnboardingSent di bawah).
    offer_status: a.offer_status ?? null,
    // FIX: sebelumnya field ini tidak pernah dikirim ke frontend, padahal
    // ini satu-satunya cara frontend (useCandidatesData.ts) bisa menghitung
    // status "expired" — offer yang sudah pending tapi lewat tenggat waktu
    // tanpa direspons kandidat.
    offer_expires_at: a.offer_expires_at ?? null,
    onboarding_sent: a.onboarding_sent ?? false,
    cv_url: a.cv_url || null,
    created_at: a.created_at,
    candidate_name:
      userMap[a.candidate_id]?.full_name ||
      userMap[a.candidate_id]?.email ||
      "Kandidat",
    // candidate_email — dibutuhkan OnboardingModal/OfferLetterModal buat
    // kirim email langsung dari halaman candidate list tanpa fetch tambahan.
    candidate_email: userMap[a.candidate_id]?.email || null,
    job_id: a.jobs?.id,
    job_title: a.jobs?.title,
    // company_name — dibutuhkan OnboardingModal & email templates.
    company_name: a.jobs?.companies?.name || null,
    resume_score: a.resume_analysis?.resume_score ?? 0,
    matching_score: a.resume_analysis?.matching_score ?? 0,
    extracted_skills: a.resume_analysis?.extracted_skills || [],
  }));

  res.json(result);
};

// ── UPDATE STATUS APPLICATION ──────────────────────────────
exports.updateApplicationStatus = async (req, res, next) => {
  const { id } = req.params;
  // `skipStatusNotification` — dikirim oleh caller (sendRejectionAction)
  // yang SUDAH mengirim notifikasi lebih kaya sendiri (lewat
  // createEvaluation di evaluationController.js, untuk kasus rejected)
  // sebelum memanggil endpoint ini. Tanpa flag ini, notifMap di bawah akan
  // membuat notifikasi KEDUA untuk kejadian yang sama.
  //
  // Field tambahan (salary, start_date, notes, expires_at, accept_url,
  // decline_url) HANYA dipakai saat status === "offered" — dikirim oleh
  // sendOfferLetterAction supaya notifikasi "offer_letter" ke kandidat
  // bisa dibuat DI SINI (backend), bukan lagi manual dari Next.js action.
  // Data ini tidak tersimpan di kolom applications manapun (salary/
  // startDate/notes cuma pernah ada di form OfferLetterModal saat kirim),
  // makanya harus dilewatkan lewat body request ini, bukan dibaca dari DB.
  const {
    status,
    skipStatusNotification,
    salary,
    start_date,
    notes,
    expires_at,
    accept_url,
    decline_url,
  } = req.body;

  // FIX: 3 status otomatis baru ditambahkan di sini — "interview" (di-set
  // dari useInterviewSchedule.ts begitu form Create Interview disubmit),
  // "evaluated" (dari useEvaluationFlow.ts handleHire, setelah evaluasi
  // "Hire" tersimpan tapi SEBELUM offer letter dikirim), dan "onboard"
  // (dari CandidatesTable.tsx onSent, setelah onboarding email sukses
  // terkirim). Tanpa ini, ketiga PUT /status yang dikirim dari flow
  // masing-masing akan selalu ditolak 400 "Status tidak valid" oleh
  // whitelist ini — request-nya sampai ke backend, tapi tidak pernah
  // benar-benar tersimpan ke kolom `status`.
  const validStatuses = [
    "applied",
    "review",
    "shortlisted",
    "interview",
    "evaluated",
    "offered",
    "hired",
    "onboard",
    "rejected",
  ];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", req.user.id)
    .single();

  if (!company) return res.status(403).json({ error: "Forbidden" });

  // Verifikasi bahwa application `:id` ini benar milik job di company
  // milik HR yang login. Tanpa ini, HR perusahaan A bisa mengubah status
  // lamaran milik perusahaan B hanya dengan mengganti :id di URL (IDOR).
  const { data: existingApp, error: existingAppError } = await supabase
    .from("applications")
    .select("id, jobs(company_id)")
    .eq("id", id)
    .single();

  if (existingAppError || !existingApp) {
    return res.status(404).json({ error: "Lamaran tidak ditemukan" });
  }

  if (existingApp.jobs?.company_id !== company.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ status })
    .eq("id", id)
    .select("id, status, candidate_id, jobs(title)")
    .single();

  if (error) return next(error);

  const jobTitle = data.jobs?.title || "posisi ini";
  const notifMap = {
    review: {
      type: "status_update",
      title: "Lamaran Sedang Direview",
      message: `Lamaranmu untuk ${jobTitle} sedang ditinjau oleh tim HR.`,
    },
    shortlisted: {
      type: "status_update",
      title: "Kamu Shortlisted! 🎉",
      message: `Selamat! Lamaranmu untuk ${jobTitle} lolos ke tahap berikutnya.`,
    },
    // TAMBAHAN: notifikasi untuk status "interview" — dikirim di sini
    // (bukan dari useInterviewSchedule.ts) karena PUT /status ini memang
    // dipanggil fire-and-forget TANPA skipStatusNotification dari hook
    // itu, jadi notifMap akan otomatis jalan untuk event ini.
    //
    // CATATAN: kalau POST /api/interviews (interviewController.js) di
    // controller lain SUDAH mengirim notifikasi tersendiri ke kandidat
    // soal jadwal interview-nya (mis. "Interview Dijadwalkan" lengkap
    // dengan tanggal/jam/link), maka entry ini akan bikin kandidat
    // menerima 2 notifikasi untuk 1 aksi HR — sama seperti bug yang
    // sudah diperbaiki untuk offered/rejected lewat skipStatusNotification.
    // Cek dulu interviewController.js: kalau memang sudah ada notifikasi
    // sendiri di sana, HAPUS entry "interview" ini dari notifMap (biarkan
    // status tetap tersimpan, cukup skip notifikasi generiknya).
    interview: {
      type: "status_update",
      title: "Interview Dijadwalkan 📅",
      message: `Kamu dijadwalkan untuk interview posisi ${jobTitle}. Cek detail jadwalnya di dashboard.`,
    },
    rejected: {
      type: "general",
      title: "Update Status Lamaran",
      message: `Lamaranmu untuk ${jobTitle} tidak dilanjutkan. Jangan menyerah!`,
    },
    // TAMBAHAN: notifikasi untuk status "offered" — SEBELUMNYA dikirim
    // manual dari sendOfferLetterAction (Next.js action) sebagai notif
    // terpisah. Sekarang dipindah ke sini supaya backend jadi satu-satunya
    // sumber notifikasi in-app untuk event ini (pola sama seperti
    // onboarding/reject). Data accept_url/decline_url/salary/expires_at
    // datang dari body request (lihat komentar di atas), bukan dari DB.
    //
    // type "offer_letter" dipertahankan (bukan "status_update") supaya
    // OfferNotifCard.tsx dan komponen UI lain yang sudah nge-filter/
    // styling berdasarkan type ini tidak perlu berubah.
    //
    // FIX (wording): sebelumnya pesan cuma bilang "Kamu mendapat offer...
    // Salary: X" — tidak ada arahan sama sekali kalau detail lengkap offer
    // letter (PDF attachment, syarat & ketentuan, deadline respons)
    // sebenarnya ada di EMAIL (dikirim oleh sendOfferLetterAction lewat
    // Gmail SMTP), bukan di notifikasi in-app ini. Kandidat yang cuma
    // baca notif bell bisa mengira ini semua informasinya. Sekarang
    // ditambah arahan eksplisit untuk cek email + cek folder spam, karena
    // email dari domain baru/kurang dikenal (RecruitAI) cukup sering
    // ke-filter otomatis ke spam oleh provider email kandidat.
    offered: {
      type: "offer_letter",
      title: `🎉 Job Offer — ${jobTitle}`,
      message: `Kamu mendapat offer untuk posisi ${jobTitle}.${salary ? ` Salary: ${salary}.` : ""} Detail lengkap offer letter-nya sudah dikirim ke emailmu — jangan lupa cek folder spam/promosi juga kalau belum kelihatan di inbox.`,
    },
    // TIDAK ada entry untuk "evaluated" — status ini murni internal HR
    // (evaluasi selesai, offer letter belum dikirim), tidak ada yang
    // sifatnya "kabar" untuk kandidat.
    //
    // TIDAK ada entry untuk "onboard" — notifikasi onboarding dibuat di
    // updateOnboardingSent (endpoint terpisah), bukan di sini.
  };

  // Hanya kirim notifikasi generik di sini kalau caller belum mengirim
  // notifikasinya sendiri (lihat komentar skipStatusNotification di atas).
  if (notifMap[status] && !skipStatusNotification) {
    const n = notifMap[status];
    // Metadata dasar dipakai semua status. Untuk "offered" ditambah field
    // yang dibutuhkan OfferNotifCard.tsx di frontend supaya tombol
    // Accept/Decline di kartu notifikasi berfungsi (application_id di
    // dalam metadata, accept_url, decline_url) plus data ringkasan
    // (salary, start_date, notes, expires_at, offer_status: "pending").
    const metadata =
      status === "offered"
        ? {
            application_id: id,
            job_title: jobTitle,
            salary: salary ?? null,
            start_date: start_date ?? null,
            notes: notes ?? null,
            expires_at: expires_at ?? null,
            offer_status: "pending",
            accept_url: accept_url ?? null,
            decline_url: decline_url ?? null,
          }
        : { application_id: id, job_title: jobTitle };

    await createNotification(data.candidate_id, n.type, n.title, n.message, metadata);
  }

  // TAMBAHAN: notifikasi ke HR sendiri (req.user.id) sebagai
  // confirmation/audit-trail record di notification bell — bukan cuma
  // toast sukses yang hilang begitu modal ditutup. Kandidat SUDAH dapat
  // notif "offer_letter" dari sendOfferLetterAction sebelum endpoint ini
  // dipanggil (lihat step 3 di offerActions.ts) — ini cuma melengkapi
  // sisi HR supaya kedua pihak sama-sama punya catatan persisten.
  //
  // Independen dari skipStatusNotification di atas (flag itu cuma untuk
  // notifMap candidate) — HR tetap dapat notif ini walau
  // skipStatusNotification: true dikirim oleh caller.
  const hrNotifMap = {
    offered: {
      title: "Offer Letter Terkirim 📨",
      message: `Offer letter untuk posisi ${jobTitle} berhasil dikirim ke kandidat.`,
    },
  };

  if (hrNotifMap[status]) {
    const n = hrNotifMap[status];
    await createNotification(req.user.id, "status_update", n.title, n.message, {
      application_id: id,
      job_title: jobTitle,
    });
  }

  res.json(data);
};

// ── APPLY JOB ──────────────────────────────────────────────
exports.applyJob = async (req, res, next) => {
  const { job_id, cv_url, analysis } = req.body;

  if (!job_id) return res.status(400).json({ error: "job_id wajib diisi" });

  const { data: existing } = await supabase
    .from("applications")
    .select("id")
    .eq("job_id", job_id)
    .eq("candidate_id", req.user.id)
    .maybeSingle();

  if (existing) {
    return res.status(409).json({ error: "Kamu sudah melamar ke posisi ini" });
  }

  const { data: application, error: appError } = await supabase
    .from("applications")
    .insert([
      {
        job_id,
        candidate_id: req.user.id,
        cv_url: cv_url || null,
        status: "applied",
      },
    ])
    .select()
    .single();

  if (appError) return next(appError);

  // ── Ambil detail job + company + nama kandidat ──────────
  const { data: jobDetail } = await supabase
    .from("jobs")
    .select("title, companies(id, name, hr_id)")
    .eq("id", job_id)
    .single();

  const { data: candidateDetail } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", req.user.id)
    .single();

  const candidateName =
    candidateDetail?.full_name || candidateDetail?.email || "Kandidat";

  if (jobDetail) {
    const jobTitle = jobDetail.title;
    const companyName = jobDetail.companies?.name || "perusahaan";
    const hrId = jobDetail.companies?.hr_id;

    // Notif konfirmasi ke kandidat
    await createNotification(
      req.user.id,
      "general",
      "Lamaran Terkirim ✅",
      `Lamaranmu untuk ${jobTitle} di ${companyName} berhasil dikirim. Pantau terus statusnya!`,
      { application_id: application.id, job_title: jobTitle, company_name: companyName },
    );

    // Notif ke HR bahwa ada lamaran baru masuk
    if (hrId) {
      await createNotification(
        hrId,
        "general",
        "Lamaran Baru Masuk 📄",
        `${candidateName} baru saja melamar posisi ${jobTitle}.`,
        { application_id: application.id, job_title: jobTitle },
      );
    }
  }

  // ── Simpan hasil analisis CV jika ada ──────────────────
  if (analysis) {
    const { error: analysisError } = await supabase
      .from("resume_analysis")
      .insert([
        {
          application_id: application.id,
          resume_score: analysis.resumeScore,
          matching_score: analysis.matchingScore,
          ats_score: analysis.atsScore,
          overall_score: analysis.overallScore,
          extracted_skills: analysis.skills,
          categories: analysis.categories,
          strengths: analysis.strengths,
          improvements: analysis.improvements,
        },
      ]);

    if (analysisError)
      logger.error({ err: analysisError }, "Gagal simpan resume analysis");
  }

  res.status(201).json(application);
};

// ── GET MY APPLICATIONS (candidate) ───────────────────────
exports.getMyApplications = async (req, res, next) => {
  const { data, error } = await supabase
    .from("applications")
    .select(
      `
      id, status, created_at, cv_url, job_id,
      jobs(title, companies(name)),
      resume_analysis(resume_score, matching_score)
    `,
    )
    .eq("candidate_id", req.user.id)
    .order("created_at", { ascending: false });

  if (error) return next(error);

  const result = data.map((a) => ({
    id: a.id,
    job_id: a.job_id,
    status: a.status,
    created_at: a.created_at,
    cv_url: a.cv_url || null,
    job_title: a.jobs?.title || "—",
    company_name: a.jobs?.companies?.name || "—",
    resume_score: a.resume_analysis?.resume_score ?? 0,
    matching_score: a.resume_analysis?.matching_score ?? 0,
  }));

  res.json(result);
};

// ── CHECK APPLIED ──────────────────────────────────────────
exports.checkApplied = async (req, res, next) => {
  const { job_id } = req.params;

  const { data } = await supabase
    .from("applications")
    .select("id, status")
    .eq("job_id", job_id)
    .eq("candidate_id", req.user.id)
    .maybeSingle();

  res.json({ applied: !!data, status: data?.status || null });
};

// ── CREATE OFFER TOKEN ──────────────────────────────────────
// Dipanggil oleh Next.js server action (sendOfferLetterAction) SEBELUM
// mengirim email, dengan Bearer token milik HR yang sedang login.
// Backend generate signed token (HMAC) yang nanti disisipkan HR ke
// acceptUrl/declineUrl di email, supaya kandidat bisa merespons tanpa
// perlu login. Endpoint ini juga menandai offer sebagai "pending" di DB.
exports.createOfferToken = async (req, res, next) => {
  const { id } = req.params;
  const { expires_at } = req.body;

  if (!expires_at) {
    return res.status(400).json({ error: "expires_at wajib diisi" });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", req.user.id)
    .single();

  if (!company) return res.status(403).json({ error: "Forbidden" });

  const { data: app } = await supabase
    .from("applications")
    .select("id, jobs(company_id)")
    .eq("id", id)
    .single();

  if (!app || app.jobs?.company_id !== company.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ offer_status: "pending", offer_expires_at: expires_at })
    .eq("id", id);

  if (updateError) return next(updateError);

  let token;
  try {
    token = sign(id, expires_at);
  } catch (err) {
    return next(err);
  }

  res.json({ token });
};

// ── UPDATE OFFER STATUS (accept / decline) ─────────────────
// Dilindungi offerAuthMiddleware, bukan authMiddleware biasa — bisa
// diakses lewat session kandidat (dashboard) ATAU signed token dari
// link email (req.offerAuthVia menandai jalur mana yang dipakai).
exports.updateOfferStatus = async (req, res, next) => {
  const { id } = req.params;
  const { offer_status } = req.body;

  const validOfferStatuses = ["accepted", "declined"];
  if (!validOfferStatuses.includes(offer_status)) {
    return res.status(400).json({ error: "offer_status tidak valid" });
  }

  // companies(name) di-select juga (sebelumnya cuma hr_id) — ini dipakai
  // untuk mengisi company_name di response akhir, bukan cuma untuk
  // notifikasi ke HR.
  const { data: app, error: appError } = await supabase
    .from("applications")
    .select("id, candidate_id, status, offer_status, offer_expires_at, jobs(title, companies(hr_id, name))")
    .eq("id", id)
    .single();

  if (appError || !app) {
    return res.status(404).json({ error: "Lamaran tidak ditemukan" });
  }

  // Kalau masuk lewat session (bukan link email token), pastikan yang
  // login memang kandidat pemilik lamaran ini.
  if (req.offerAuthVia === "session" && req.user.id !== app.candidate_id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (app.offer_expires_at && new Date(app.offer_expires_at) < new Date()) {
    return res.status(410).json({ error: "Offer sudah kedaluwarsa" });
  }

  // Cegah double-submit / replay link email yang sudah pernah dipakai.
  if (app.offer_status && app.offer_status !== "pending") {
    return res.status(409).json({
      error: `Offer sudah pernah direspons sebelumnya (${app.offer_status})`,
    });
  }

  const updateData = { offer_status };
  if (offer_status === "accepted") updateData.status = "hired";

  const { data, error } = await supabase
    .from("applications")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) return next(error);

  const jobTitle = app.jobs?.title || "posisi ini";
  const isAccepted = offer_status === "accepted";

  // ── Sync notifikasi offer_letter lama ────────────────────────────────
  // Sync kandidat punya notifikasi "offer_letter" yang sudah ada supaya
  // OfferNotifCard di dashboard ikut mencerminkan accepted/declined,
  // termasuk saat kandidat merespons lewat link email
  // (req.offerAuthVia === "token"), bukan cuma waktu klik tombol di
  // dalam dashboard. title/message ikut diperbarui dan `read` di-reset
  // ke false supaya muncul lagi sebagai pembaruan baru di notification
  // bell.
  try {
    const { data: existingNotif } = await supabase
      .from("notifications")
      .select("id, metadata")
      .eq("application_id", id)
      .eq("type", "offer_letter")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingNotif) {
      await supabase
        .from("notifications")
        .update({
          title: isAccepted
            ? `Offer Diterima — ${jobTitle}`
            : `Offer Ditolak — ${jobTitle}`,
          message: isAccepted
            ? `Kamu telah menerima offer untuk posisi ${jobTitle}.`
            : `Kamu telah menolak offer untuk posisi ${jobTitle}.`,
          metadata: {
            ...(existingNotif.metadata || {}),
            offer_status,
          },
          read: false,
        })
        .eq("id", existingNotif.id);
    }
  } catch (notifSyncErr) {
    // Non-critical — applications adalah source of truth utamanya; log
    // dan lanjut supaya response ke kandidat/link email tetap berhasil.
    logger.error({ err: notifSyncErr }, "[updateOfferStatus] Gagal sync notification metadata");
  }

  // ── Notifikasi ke HR & Kandidat ─────────────────────────────
  const hrId = app.jobs?.companies?.hr_id;

  // Notifikasi ke HR
  if (hrId) {
    await createNotification(
      hrId,
      "status_update",
      isAccepted ? "Offer Diterima 🎉" : "Offer Ditolak",
      `Kandidat telah ${isAccepted ? "menerima" : "menolak"} offer untuk posisi ${jobTitle}.`,
      { application_id: id, job_title: jobTitle, offer_status },
    );
  }

  // Notifikasi ke Kandidat — dibiarkan tetap ada sebagai entri riwayat
  // terpisah (selain notifikasi offer_letter yang sudah disinkronkan di
  // atas), sekarang membawa metadata yang seragam juga.
  await createNotification(
    app.candidate_id,
    "status_update",
    isAccepted ? "Selamat! Kamu Resmi Diterima 🎉" : "Offer Berhasil Ditolak",
    isAccepted
      ? `Selamat! Kamu resmi diterima untuk posisi ${jobTitle}. Kami menantikan kehadiranmu di tim.`
      : `Kamu telah menolak offer untuk posisi ${jobTitle}.`,
    { application_id: id, job_title: jobTitle, offer_status },
  );

  // ── Enrich response dengan candidate_name/email + company_name ──────
  // Sebelumnya endpoint ini cuma `res.json(data)` — `data` adalah row mentah
  // tabel applications (id, candidate_id, status, offer_status, dst), TANPA
  // nama/email kandidat atau nama company. Akibatnya respondToOfferAction di
  // sisi Next.js tidak punya data apapun untuk mengirim email konfirmasi
  // "welcome aboard" begitu offer di-accept.
  //
  // req.user TIDAK bisa dipakai di sini untuk data kandidat — saat masuk
  // lewat link email (req.offerAuthVia === "token"), req.user tidak pernah
  // di-set oleh offerAuthMiddleware. Jadi ambil terpisah via app.candidate_id,
  // mengikuti pola yang sama dengan getHRApplications/applyJob.
  const { data: candidateDetail } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", app.candidate_id)
    .single();

  res.json({
    ...data,
    candidate_name: candidateDetail?.full_name || candidateDetail?.email || null,
    candidate_email: candidateDetail?.email || null,
    job_title: jobTitle,
    company_name: app.jobs?.companies?.name || null,
  });
};

// ── UPDATE ONBOARDING SENT FLAG ─────────────────────────────
// Dipanggil oleh Next.js server action (sendOnboardingEmailAction) SETELAH
// berhasil mengirim email detail onboarding ke kandidat — supaya tombol
// "Kirim Onboarding Email" di dashboard HR berubah jadi "Sudah Dikirim" dan
// tidak bisa dikirim dobel ke kandidat yang sama.
exports.updateOnboardingSent = async (req, res, next) => {
  const { id } = req.params;
  const { onboarding_sent } = req.body;

  if (typeof onboarding_sent !== "boolean") {
    return res.status(400).json({ error: "onboarding_sent harus boolean" });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", req.user.id)
    .single();

  if (!company) return res.status(403).json({ error: "Forbidden" });

  // Cegah IDOR — sama seperti updateApplicationStatus & createOfferToken:
  // pastikan application `:id` ini benar milik job di company milik HR yang
  // sedang login, bukan milik company lain.
  const { data: existingApp, error: existingAppError } = await supabase
    .from("applications")
    .select("id, jobs(company_id)")
    .eq("id", id)
    .single();

  if (existingAppError || !existingApp) {
    return res.status(404).json({ error: "Lamaran tidak ditemukan" });
  }

  if (existingApp.jobs?.company_id !== company.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // FIX: select() diperluas untuk menyertakan candidate_id — sebelumnya
  // cuma "id, onboarding_sent, jobs(title)", tidak cukup untuk tahu
  // notifikasi kandidat di bawah ini harus dikirim ke siapa. Mengikuti
  // pola yang sama dengan applyJob/updateApplicationStatus/
  // updateOfferStatus, yang semuanya butuh candidate_id untuk notifikasi
  // dua arah (HR + kandidat).
  const { data, error } = await supabase
    .from("applications")
    .update({ onboarding_sent })
    .eq("id", id)
    .select("id, onboarding_sent, candidate_id, jobs(title)")
    .single();

  if (error) return next(error);

  // ── Notifikasi ke HR & Kandidat ──────────────────────────────────────
  // Simetris dengan pola applyJob (notif ke kandidat + notif ke HR untuk
  // 1 aksi yang sama) dan updateOfferStatus (notif dua arah saat
  // accept/decline). Cuma dikirim saat benar-benar ditandai terkirim
  // (onboarding_sent === true) — bukan saat di-set false lagi (kalau
  // suatu saat ada alur untuk itu), supaya tidak ada yang dapat notif
  // untuk aksi yang bukan "berhasil mengirim sesuatu".
  if (onboarding_sent) {
    const jobTitle = data.jobs?.title || "posisi ini";

    // Notifikasi ke HR — confirmation/audit-trail record di notification
    // bell, bukan cuma toast sukses yang hilang begitu modal ditutup.
    await createNotification(
      req.user.id,
      "status_update",
      "Onboarding Email Terkirim 📋",
      `Detail onboarding untuk posisi ${jobTitle} berhasil dikirim ke kandidat.`,
      { application_id: id, job_title: jobTitle },
    );

    // Notifikasi ke Kandidat — ucapan selamat di notification bell,
    // bukan cuma lewat email.
    //
    // ⚠️ RISIKO DOBEL NOTIF: sendOnboardingEmailAction (Next.js action)
    // SUDAH mengirim notif tipe "onboarding" ke kandidat ini SEBELUM
    // endpoint ini dipanggil (lihat step 2 di onboardingActions.ts).
    // Kalau notif itu pesannya sudah serupa ("cek email untuk detail
    // onboarding"), kandidat akan menerima 2 notifikasi untuk 1 aksi HR
    // yang sama — persis kelas bug yang sudah diperbaiki untuk
    // offered/rejected lewat skipStatusNotification. Cek dulu
    // onboardingActions.ts: kalau notifnya sudah cukup, HAPUS blok
    // createNotification kandidat ini dan biarkan cuma notif HR di atas
    // yang jalan dari sini.
    await createNotification(
      data.candidate_id,
      "status_update",
      "Selamat, Kamu Sudah Onboard! 🎊",
      `Selamat bergabung! Detail onboarding untuk posisi ${jobTitle} sudah dikirim ke emailmu — cek email untuk lihat apa saja yang perlu kamu siapkan sebelum hari pertama.`,
      { application_id: id, job_title: jobTitle },
    );
  }

  res.json(data);
};