const supabase = require("../config/supabase");

// ── GET semua saved jobs milik kandidat ───────────────────
exports.getSavedJobs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("saved_jobs")
      .select(
        `
        id,
        created_at,
        jobs(
          id, title, salary, location, type, skills, deadline, created_at,
          companies(name, logo_url, company_size)
        )
      `,
      )
      .eq("candidate_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    const result = data.map((s) => ({
      saved_id: s.id,
      saved_at: s.created_at,
      ...s.jobs,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── SAVE job ──────────────────────────────────────────────
exports.saveJob = async (req, res) => {
  try {
    const { job_id } = req.body;
    if (!job_id) return res.status(400).json({ error: "job_id wajib diisi" });

    // Cek sudah pernah disave
    const { data: existing } = await supabase
      .from("saved_jobs")
      .select("id")
      .eq("candidate_id", req.user.id)
      .eq("job_id", job_id)
      .maybeSingle();

    if (existing) return res.status(409).json({ error: "Sudah disimpan" });

    const { data, error } = await supabase
      .from("saved_jobs")
      .insert([{ candidate_id: req.user.id, job_id }])
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UNSAVE job ────────────────────────────────────────────
exports.unsaveJob = async (req, res) => {
  try {
    const { job_id } = req.params;

    const { error } = await supabase
      .from("saved_jobs")
      .delete()
      .eq("candidate_id", req.user.id)
      .eq("job_id", job_id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CEK apakah job sudah disave ───────────────────────────
exports.checkSaved = async (req, res) => {
  try {
    const { job_id } = req.params;

    const { data } = await supabase
      .from("saved_jobs")
      .select("id")
      .eq("candidate_id", req.user.id)
      .eq("job_id", job_id)
      .maybeSingle();

    res.json({ saved: !!data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
