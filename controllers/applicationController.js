const { createNotification } = require("./notificationController");
const supabase = require("../config/supabase");

// ── GET HR APPLICATIONS ────────────────────────────────────
exports.getHRApplications = async (req, res) => {
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
      id, status, cv_url, created_at, candidate_id, job_id,
      jobs(id, title),
      resume_analysis(resume_score, matching_score, extracted_skills)
    `,
    )
    .in("job_id", jobIds)
    .order("created_at", { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

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
    cv_url: a.cv_url || null,
    created_at: a.created_at,
    candidate_name:
      userMap[a.candidate_id]?.full_name ||
      userMap[a.candidate_id]?.email ||
      "Kandidat",
    job_id: a.jobs?.id,
    job_title: a.jobs?.title,
    resume_score: a.resume_analysis?.resume_score ?? 0,
    matching_score: a.resume_analysis?.matching_score ?? 0,
    extracted_skills: a.resume_analysis?.extracted_skills || [],
  }));

  res.json(result);
};

// ── UPDATE STATUS APPLICATION ──────────────────────────────
exports.updateApplicationStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ["applied", "review", "shortlisted", "rejected"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }

  const { data: company } = await supabase
    .from("companies")
    .select("id")
    .eq("hr_id", req.user.id)
    .single();

  if (!company) return res.status(403).json({ error: "Forbidden" });

  const { data, error } = await supabase
    .from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, status, candidate_id, jobs(title)")
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // ── Trigger notifikasi ke kandidat ──────────────────────
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
    rejected: {
      type: "general",
      title: "Update Status Lamaran",
      message: `Lamaranmu untuk ${jobTitle} tidak dilanjutkan. Jangan menyerah!`,
    },
  };

  if (notifMap[status]) {
    const n = notifMap[status];
    await createNotification(data.candidate_id, n.type, n.title, n.message);
  }

  res.json(data);
};

// ── APPLY JOB ──────────────────────────────────────────────
exports.applyJob = async (req, res) => {
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

  if (appError) return res.status(500).json({ error: appError.message });

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
    );

    // Notif ke HR bahwa ada lamaran baru masuk
    if (hrId) {
      await createNotification(
        hrId,
        "general",
        "Lamaran Baru Masuk 📄",
        `${candidateName} baru saja melamar posisi ${jobTitle}.`,
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
      console.error("❌ Gagal simpan analisis:", analysisError.message);
  }

  res.status(201).json(application);
};

// ── GET MY APPLICATIONS (candidate) ───────────────────────
exports.getMyApplications = async (req, res) => {
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

  if (error) return res.status(500).json({ error: error.message });

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
exports.checkApplied = async (req, res) => {
  const { job_id } = req.params;

  const { data } = await supabase
    .from("applications")
    .select("id, status")
    .eq("job_id", job_id)
    .eq("candidate_id", req.user.id)
    .maybeSingle();

  res.json({ applied: !!data, status: data?.status || null });
};
