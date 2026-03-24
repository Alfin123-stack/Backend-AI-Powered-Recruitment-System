const supabase = require("../config/supabase");

// ── CREATE JOB ─────────────────────────────────────────────
exports.createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      requirements,
      salary,
      location,
      type,
      skills,
      benefits,
      deadline,
    } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title wajib diisi" });
    }

    // Ambil company milik HR yang login
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (companyError || !company) {
      return res.status(403).json({
        error: "HR belum memiliki company, buat company terlebih dahulu",
      });
    }

    const { data, error } = await supabase
      .from("jobs")
      .insert([
        {
          company_id: company.id,
          title,
          description,
          requirements,
          salary,
          location,
          type: type || "Full-time",
          skills: skills || [],
          benefits: benefits || [],
          deadline: deadline || null,
          is_active: true,
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

// ── GET ALL JOBS (public) ───────────────────────────────────
exports.getJobs = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("jobs")
      .select(
        `
        *,
        companies(name, logo_url, company_size)
      `,
      )
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE JOB ─────────────────────────────────────────────
exports.updateJob = async (req, res) => {
  try {
    const { id } = req.params;

    // Pastikan job ini milik company HR yang login
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.status(403).json({ error: "Forbidden" });

    const { data, error } = await supabase
      .from("jobs")
      .update(req.body)
      .eq("id", id)
      .eq("company_id", company.id) // double check ownership
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── DELETE JOB (soft delete) ───────────────────────────────
exports.deleteJob = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.status(403).json({ error: "Forbidden" });

    // Soft delete — set is_active false, tidak hapus dari DB
    const { error } = await supabase
      .from("jobs")
      .update({ is_active: false })
      .eq("id", id)
      .eq("company_id", company.id);

    if (error) return res.status(500).json({ error: error.message });

    res.json({ message: "Lowongan berhasil ditutup" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET MY JOBS (HR only) ──────────────────────────────────
exports.getMyJobs = async (req, res) => {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.json([]);

    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("company_id", company.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


// ── GET JOB BY ID (public) ─────────────────────────────────
exports.getJobById = async (req, res) => {
  try {
    const { id } = req.params

    const { data, error } = await supabase
      .from("jobs")
      .select(`
        *,
        companies(id, name, description, company_size, logo_url)
      `)
      .eq("id", id)
      .eq("is_active", true)
      .single()

    if (error && error.code === "PGRST116") {
      return res.status(404).json({ error: "Lowongan tidak ditemukan" })
    }

    if (error) return res.status(500).json({ error: error.message })

    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}