const supabase = require("../config/supabase");

// ── FIELD YANG BOLEH DIUBAH LEWAT updateJob (whitelist, cegah mass assignment) ──
const JOB_UPDATABLE_FIELDS = [
  "title",
  "description",
  "requirements",
  "salary",
  "location",
  "type",
  "skills",
  "benefits",
  "deadline",
  "is_active",
];

function pickUpdatableFields(body) {
  const result = {};
  for (const key of JOB_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      result[key] = body[key];
    }
  }
  return result;
}

// ── CREATE JOB ─────────────────────────────────────────────
exports.createJob = async (req, res, next) => {
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

    if (error) return next(error);

    res.status(201).json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET ALL JOBS (public) ───────────────────────────────────
exports.getJobs = async (req, res, next) => {
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

    if (error) return next(error);

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── UPDATE JOB ─────────────────────────────────────────────
exports.updateJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Pastikan job ini milik company HR yang login
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.status(403).json({ error: "Forbidden" });

    // FIX (security): jangan pernah update(req.body) mentah — mass assignment.
    // Hanya field di JOB_UPDATABLE_FIELDS yang boleh diubah lewat endpoint ini.
    const updates = pickUpdatableFields(req.body);

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "Tidak ada field valid untuk diupdate" });
    }

    const { data, error } = await supabase
      .from("jobs")
      .update(updates)
      .eq("id", id)
      .eq("company_id", company.id) // double check ownership
      .select()
      .single();

    if (error) return next(error);

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── DELETE JOB (soft delete) ───────────────────────────────
exports.deleteJob = async (req, res, next) => {
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

    if (error) return next(error);

    res.json({ message: "Lowongan berhasil ditutup" });
  } catch (err) {
    next(err);
  }
};

// ── GET MY JOBS (HR only) ──────────────────────────────────
exports.getMyJobs = async (req, res, next) => {
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

    if (error) return next(error);

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET JOB BY ID (public) ─────────────────────────────────
exports.getJobById = async (req, res, next) => {
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

    if (error) return next(error)

    res.json(data)
  } catch (err) {
    next(err)
  }
}
