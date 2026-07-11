const supabase = require("../config/supabase");

// ── GET MY COMPANY ─────────────────────────────────────────
exports.getMyCompany = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("hr_id", req.user.id)
      .single();

    if (error && error.code === "PGRST116") {
      return res.json(null);
    }

    if (error) return next(error);

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── CREATE COMPANY ─────────────────────────────────────────
exports.createCompany = async (req, res, next) => {
  try {
    const { name, description, company_size } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Nama perusahaan wajib diisi" });
    }

    const { data: existing } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (existing) {
      return res.status(409).json({ error: "HR sudah memiliki perusahaan" });
    }

    const { data, error } = await supabase
      .from("companies")
      .insert([
        {
          hr_id: req.user.id,
          name: name.trim(),
          description: description?.trim() || null,
          company_size: company_size || null,
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

// ── UPDATE COMPANY ─────────────────────────────────────────
exports.updateCompany = async (req, res, next) => {
  try {
    const { name, description, company_size } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ error: "Nama perusahaan wajib diisi" });
    }

    const { data, error } = await supabase
      .from("companies")
      .update({
        name: name.trim(),
        description: description?.trim() || null,
        company_size: company_size || null,
      })
      .eq("hr_id", req.user.id)
      .select()
      .single();

    if (error) return next(error);

    res.json(data);
  } catch (err) {
    next(err);
  }
};

// ── GET PUBLIC COMPANIES ───────────────────────────────────
exports.getPublicCompanies = async (req, res, next) => {
  try {
    const { data, error } = await supabase.from("companies").select(`
        id,
        name,
        description,
        company_size,
        logo_url,
        jobs(id, title, location, skills, is_active)
      `);

    if (error) return next(error);

    const result = data
      .map((c) => {
        const activeJobs = (c.jobs || []).filter((j) => j.is_active);
        if (activeJobs.length === 0) return null;

        const location = activeJobs[0]?.location?.split("/")[0]?.trim() || null;
        const tags = [
          ...new Set(activeJobs.flatMap((j) => (j.skills || []).slice(0, 2))),
        ].slice(0, 3);

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          company_size: c.company_size,
          logo_url: c.logo_url,
          website: null,
          verified: false,
          openJobs: activeJobs.length,
          location,
          tags,
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

// ── GET COMPANY BY ID (public) ─────────────────────────────
exports.getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Ambil semua kolom yang dibutuhkan frontend termasuk website & verified
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("id, name, description, company_size, logo_url")
      .eq("id", id)
      .single();

    if (companyError && companyError.code === "PGRST116") {
      return res.status(404).json({ error: "Perusahaan tidak ditemukan" });
    }

    if (companyError) {
      return next(companyError);
    }

    // Ambil semua jobs aktif milik company ini
    const { data: jobs, error: jobsError } = await supabase
      .from("jobs")
      .select(
        "id, title, description, requirements, salary, location, type, skills, benefits, deadline, is_active, created_at, company_id",
      )
      .eq("company_id", id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });

    if (jobsError) {
      return next(jobsError);
    }

    const activeJobs = jobs || [];

    // Derive location & tags dari jobs aktif
    const location = activeJobs[0]?.location?.split("/")[0]?.trim() || null;
    const tags = [
      ...new Set(activeJobs.flatMap((j) => (j.skills || []).slice(0, 2))),
    ].slice(0, 3);

    res.json({
      company: {
        ...company,
        location,
        tags,
        openJobs: activeJobs.length,
        website: null, // kolom belum ada di tabel — tambah migrasi jika perlu
        verified: false, // kolom belum ada di tabel — tambah migrasi jika perlu
      },
      jobs: activeJobs,
    });
  } catch (err) {
    next(err);
  }
};
