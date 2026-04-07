const supabase = require("../config/supabase");

// ── GET ALL INTERVIEWS milik HR ────────────────────────────
exports.getHRInterviews = async (req, res) => {
  try {
    // Cari company milik HR
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.json([]);

    // Ambil job ids milik company
    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("company_id", company.id);

    if (!jobs || jobs.length === 0) return res.json([]);

    const jobIds = jobs.map((j) => j.id);

    // Ambil application ids dari job-job tersebut
    const { data: applications } = await supabase
      .from("applications")
      .select("id, candidate_id, job_id, jobs(title)")
      .in("job_id", jobIds);

    if (!applications || applications.length === 0) return res.json([]);

    const appIds = applications.map((a) => a.id);

    // Ambil interviews
    const { data: interviews, error } = await supabase
      .from("interviews")
      .select("*")
      .in("application_id", appIds)
      .order("scheduled_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Ambil nama kandidat
    const candidateIds = [...new Set(applications.map((a) => a.candidate_id))];
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", candidateIds);

    const userMap = {};
    (users || []).forEach((u) => {
      userMap[u.id] = u;
    });

    const appMap = {};
    applications.forEach((a) => {
      appMap[a.id] = a;
    });

    const result = interviews.map((iv) => {
      const app = appMap[iv.application_id];
      const candidate = app ? userMap[app.candidate_id] : null;
      return {
        id: iv.id,
        application_id: iv.application_id,
        scheduled_at: iv.scheduled_at,
        type: iv.type,
        location: iv.location,
        notes: iv.notes,
        status: iv.status,
        created_at: iv.created_at,
        candidate_name: candidate?.full_name || candidate?.email || "Kandidat",
        job_title: app?.jobs?.title || "—",
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET SHORTLISTED CANDIDATES (belum dijadwalkan) ─────────
exports.getShortlistedCandidates = async (req, res) => {
  try {
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.json([]);

    const { data: jobs } = await supabase
      .from("jobs")
      .select("id")
      .eq("company_id", company.id);

    if (!jobs || jobs.length === 0) return res.json([]);

    const jobIds = jobs.map((j) => j.id);

    // Ambil aplikasi yang shortlisted
    const { data: applications, error } = await supabase
      .from("applications")
      .select(`id, candidate_id, job_id, jobs(title)`)
      .in("job_id", jobIds)
      .eq("status", "shortlisted");

    if (error) return res.status(500).json({ error: error.message });
    if (!applications || applications.length === 0) return res.json([]);

    // Cek mana yang sudah punya interview
    const appIds = applications.map((a) => a.id);
    const { data: existingInterviews } = await supabase
      .from("interviews")
      .select("application_id")
      .in("application_id", appIds)
      .neq("status", "cancelled"); // kecuali yang dibatalkan

    const scheduledAppIds = new Set(
      (existingInterviews || []).map((iv) => iv.application_id),
    );

    // Filter yang belum dijadwalkan
    const unscheduled = applications.filter((a) => !scheduledAppIds.has(a.id));

    // Ambil nama kandidat
    const candidateIds = [...new Set(unscheduled.map((a) => a.candidate_id))];
    const { data: users } = await supabase
      .from("users")
      .select("id, full_name, email")
      .in("id", candidateIds);

    const userMap = {};
    (users || []).forEach((u) => {
      userMap[u.id] = u;
    });

    const result = unscheduled.map((a) => ({
      application_id: a.id,
      candidate_id: a.candidate_id,
      candidate_name:
        userMap[a.candidate_id]?.full_name ||
        userMap[a.candidate_id]?.email ||
        "Kandidat",
      job_title: a.jobs?.title || "—",
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── CREATE INTERVIEW ───────────────────────────────────────
exports.createInterview = async (req, res) => {
  try {
    const { application_id, scheduled_at, type, location, notes } = req.body;

    if (!application_id || !scheduled_at) {
      return res
        .status(400)
        .json({ error: "application_id dan scheduled_at wajib diisi" });
    }

    // Verifikasi aplikasi ini milik company HR yang login
    const { data: company } = await supabase
      .from("companies")
      .select("id")
      .eq("hr_id", req.user.id)
      .single();

    if (!company) return res.status(403).json({ error: "Forbidden" });

    const { data: app } = await supabase
      .from("applications")
      .select("id, jobs(company_id)")
      .eq("id", application_id)
      .single();

    if (!app || app.jobs?.company_id !== company.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { data, error } = await supabase
      .from("interviews")
      .insert([
        {
          application_id,
          scheduled_at,
          type: type || "online",
          location: location || null,
          notes: notes || null,
          status: "scheduled",
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

// ── UPDATE INTERVIEW STATUS ────────────────────────────────
exports.updateInterview = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, scheduled_at, type, location, notes } = req.body;

    const validStatuses = ["scheduled", "done", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Status tidak valid" });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (scheduled_at) updateData.scheduled_at = scheduled_at;
    if (type) updateData.type = type;
    if (location !== undefined) updateData.location = location;
    if (notes !== undefined) updateData.notes = notes;

    const { data, error } = await supabase
      .from("interviews")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── GET MY INTERVIEWS (untuk kandidat yang login) ──────────
exports.getMyInterviews = async (req, res) => {
  try {
    // Ambil semua aplikasi milik kandidat yang login
    const { data: applications, error: appError } = await supabase
      .from("applications")
      .select("id, job_id, jobs(title, company_id, companies(name))")
      .eq("candidate_id", req.user.id);

    if (appError) return res.status(500).json({ error: appError.message });
    if (!applications || applications.length === 0) return res.json([]);

    const appIds = applications.map((a) => a.id);

    // Ambil interviews dari aplikasi-aplikasi tersebut
    const { data: interviews, error } = await supabase
      .from("interviews")
      .select("*")
      .in("application_id", appIds)
      .order("scheduled_at", { ascending: true });

    if (error) return res.status(500).json({ error: error.message });

    // Map aplikasi untuk lookup cepat
    const appMap = {};
    applications.forEach((a) => {
      appMap[a.id] = a;
    });

    // Gabungkan data interview dengan job_title & company_name
    const result = (interviews || []).map((iv) => {
      const app = appMap[iv.application_id];
      return {
        id: iv.id,
        application_id: iv.application_id,
        scheduled_at: iv.scheduled_at,
        type: iv.type,
        location: iv.location,
        notes: iv.notes,
        status: iv.status,
        created_at: iv.created_at,
        job_title: app?.jobs?.title || "—",
        company_name: app?.jobs?.companies?.name || "—",
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
