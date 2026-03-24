const supabase = require("../config/supabase");

// ── GET MY COMPANY ─────────────────────────────────────────
exports.getMyCompany = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("hr_id", req.user.id)
      .single();

    if (error && error.code === "PGRST116") {
      return res.json(null);
    }

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE COMPANY ─────────────────────────────────────────
exports.createCompany = async (req, res) => {
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

    if (error) return res.status(500).json({ error: error.message });

    res.status(201).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── UPDATE COMPANY ─────────────────────────────────────────
exports.updateCompany = async (req, res) => {
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

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET PUBLIC COMPANIES ───────────────────────────────────
// Untuk halaman /company — public, tidak butuh auth
// Return semua company yang punya minimal 1 job aktif
exports.getPublicCompanies = async (req, res) => {
  try {
    const { data, error } = await supabase.from("companies").select(`
        id,
        name,
        description,
        company_size,
        logo_url,
        jobs(id, title, location, skills, is_active)
      `);

    if (error) return res.status(500).json({ error: error.message });

    // Filter hanya company yang punya job aktif
    // Hitung openJobs, ambil location & tags dari jobs
    const result = data
      .map((c) => {
        const activeJobs = (c.jobs || []).filter((j) => j.is_active);
        if (activeJobs.length === 0) return null;

        // Ambil lokasi dari job pertama
        const location = activeJobs[0]?.location?.split("/")[0]?.trim() || null;

        // Kumpulkan unique tags dari skills semua jobs aktif
        const tags = [
          ...new Set(activeJobs.flatMap((j) => (j.skills || []).slice(0, 2))),
        ].slice(0, 3);

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          company_size: c.company_size,
          logo_url: c.logo_url,
          openJobs: activeJobs.length,
          location,
          tags,
        };
      })
      .filter(Boolean); // hapus company tanpa job aktif

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
