const supabase = require("../config/supabase");

// ── GET ALL APPLICATIONS milik company HR yang login ───────
exports.getHRApplications = async (req, res) => {
  try {
    // Cari company milik HR ini
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (companyError || !company) {
      return res.status(404).json({ error: "Company tidak ditemukan" });
    }

    // Ambil semua applications untuk jobs milik company ini
    const { data, error } = await supabase
      .from("applications")
      .select(
        `
        id,
        status,
        cv_url,
        created_at,
        users(full_name),
        jobs!inner(id, title, company_id),
        resume_analysis(resume_score, matching_score, extracted_skills)
      `,
      )
      .eq("jobs.company_id", company.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Flatten data agar mudah dikonsumsi frontend
    const result = data.map((a) => ({
      id: a.id,
      status: a.status,
      cv_url: a.cv_url || null,
      created_at: a.created_at,
      candidate_name: a.users?.full_name || "Kandidat",
      job_id: a.jobs?.id,
      job_title: a.jobs?.title,
      resume_score: a.resume_analysis?.resume_score ?? 0,
      matching_score: a.resume_analysis?.matching_score ?? 0,
      extracted_skills: a.resume_analysis?.extracted_skills || [],
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE STATUS APPLICATION ──────────────────────────────
exports.updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["applied", "review", "shortlisted", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    // Pastikan application ini milik company HR yang login
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("applications")
      .update({ status })
      .eq("id", id)
      .select("id, status")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.applyJob = async (req, res) => {
  try {
    const { job_id, cv_url, analysis } = req.body;
    // analysis = hasil dari Gemini yang sudah diproses di frontend

    if (!job_id) return res.status(400).json({ error: "job_id wajib diisi" });

    // Cek sudah pernah apply belum
    const { data: existing } = await supabase
      .from("applications")
      .select("id")
      .eq("job_id", job_id)
      .eq("candidate_id", req.user.id)
      .single();

    if (existing) {
      return res
        .status(409)
        .json({ error: "Kamu sudah melamar ke posisi ini" });
    }

    // Insert application
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

    // Simpan hasil analisis AI jika ada
    if (analysis) {
      await supabase.from("resume_analysis").insert([
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
    }

    res.status(201).json(application);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// applicationController.js
exports.getMyApplications = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("applications")
      .select(
        `
        id, status, created_at, cv_url,
        jobs(title, companies(name)),
        resume_analysis(resume_score, matching_score)
      `,
      )
      .eq("candidate_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const result = data.map((a) => ({
      id: a.id,
      status: a.status,
      created_at: a.created_at,
      cv_url: a.cv_url,
      job_title: a.jobs?.title,
      company_name: a.jobs?.companies?.name,
      resume_score: a.resume_analysis?.resume_score ?? 0,
      matching_score: a.resume_analysis?.matching_score ?? 0,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.checkApplied = async (req, res) => {
  try {
    const { job_id } = req.params;

    const { data } = await supabase
      .from("applications")
      .select("id, status")
      .eq("job_id", job_id)
      .eq("candidate_id", req.user.id)
      .maybeSingle();

    res.json({ applied: !!data, status: data?.status || null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
