const supabase = require("../config/supabase");
const { createNotification } = require("./notificationController");

// ── Helper: ambil detail aplikasi untuk notif ──────────────
const getAppDetail = async (application_id) => {
  const { data } = await supabase
    .from("applications")
    .select("candidate_id, jobs(title, companies(name))")
    .eq("id", application_id)
    .single();
  return data;
};

// ── Helper: format tanggal & jam ke locale ID ──────────────
const formatSchedule = (dateStr) => {
  const date = new Date(dateStr);
  const tanggal = date.toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const jam = date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { tanggal, jam };
};

// ── GET ALL INTERVIEWS milik HR ────────────────────────────
exports.getHRInterviews = async (req, res) => {
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

  const { data: applications } = await supabase
    .from("applications")
    .select("id, candidate_id, job_id, jobs(title)")
    .in("job_id", jobIds);

  if (!applications || applications.length === 0) return res.json([]);

  const appIds = applications.map((a) => a.id);

  const { data: interviews, error } = await supabase
    .from("interviews")
    .select("*")
    .in("application_id", appIds)
    .order("scheduled_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

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

  const result = (interviews || []).map((iv) => {
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
};

// ── GET SHORTLISTED CANDIDATES (belum dijadwalkan) ─────────
exports.getShortlistedCandidates = async (req, res) => {
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

  const { data: applications, error } = await supabase
    .from("applications")
    .select("id, candidate_id, job_id, jobs(title)")
    .in("job_id", jobIds)
    .eq("status", "shortlisted");

  if (error) return res.status(500).json({ error: error.message });
  if (!applications || applications.length === 0) return res.json([]);

  const appIds = applications.map((a) => a.id);

  // Block hanya scheduled dan done — cancelled boleh dijadwalkan ulang
  const { data: existingInterviews } = await supabase
    .from("interviews")
    .select("application_id, status")
    .in("application_id", appIds);

  const blockedAppIds = new Set(
    (existingInterviews || [])
      .filter((iv) => iv.status === "scheduled" || iv.status === "done")
      .map((iv) => iv.application_id),
  );

  const unscheduled = applications.filter((a) => !blockedAppIds.has(a.id));
  if (unscheduled.length === 0) return res.json([]);

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
};

// ── CREATE INTERVIEW ───────────────────────────────────────
exports.createInterview = async (req, res) => {
  const { application_id, scheduled_at, type, location, notes } = req.body;

  if (!application_id || !scheduled_at) {
    return res
      .status(400)
      .json({ error: "application_id dan scheduled_at wajib diisi" });
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
    .eq("id", application_id)
    .single();

  if (!app || app.jobs?.company_id !== company.id) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Cek existing interview — upsert jika ada yang cancelled
  const { data: existing } = await supabase
    .from("interviews")
    .select("id, status")
    .eq("application_id", application_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const interviewPayload = {
    scheduled_at,
    type: type || "online",
    location: location || null,
    notes: notes || null,
    status: "scheduled",
  };

  let data, error;

  if (existing) {
    ({ data, error } = await supabase
      .from("interviews")
      .update(interviewPayload)
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await supabase
      .from("interviews")
      .insert([{ application_id, ...interviewPayload }])
      .select()
      .single());
  }

  if (error) return res.status(500).json({ error: error.message });

  // Trigger notifikasi ke kandidat
  const appDetail = await getAppDetail(application_id);
  if (appDetail) {
    const jobTitle = appDetail.jobs?.title || "posisi ini";
    const companyName = appDetail.jobs?.companies?.name || "perusahaan";
    const { tanggal, jam } = formatSchedule(scheduled_at);
    const tipe = (type || "online") === "online" ? "Online" : "Onsite";
    const isReschedule = !!existing;

    await createNotification(
      appDetail.candidate_id,
      "interview",
      isReschedule
        ? "Interview Dijadwalkan Ulang 🔄"
        : "Interview Dijadwalkan 📅",
      isReschedule
        ? `Interview ${tipe} untuk ${jobTitle} di ${companyName} telah dijadwalkan ulang pada ${tanggal} pukul ${jam} WIB.`
        : `Interview ${tipe} untuk ${jobTitle} di ${companyName} dijadwalkan pada ${tanggal} pukul ${jam} WIB.`,
    );
  }

  res.status(201).json(data);
};

// ── UPDATE INTERVIEW STATUS ────────────────────────────────
exports.updateInterview = async (req, res) => {
  const { id } = req.params;
  const { status, scheduled_at, type, location, notes } = req.body;

  const validStatuses = ["scheduled", "done", "cancelled"];
  if (status && !validStatuses.includes(status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }

  // Ambil data interview lama untuk perbandingan notif
  const { data: oldInterview, error: fetchError } = await supabase
    .from("interviews")
    .select("application_id, status, scheduled_at, type")
    .eq("id", id)
    .single();

  if (fetchError) return res.status(500).json({ error: fetchError.message });

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

  // Trigger notifikasi hanya jika status benar-benar berubah
  if (status && status !== oldInterview.status) {
    const appDetail = await getAppDetail(oldInterview.application_id);

    if (appDetail) {
      const jobTitle = appDetail.jobs?.title || "posisi ini";
      const companyName = appDetail.jobs?.companies?.name || "perusahaan";

      if (status === "done") {
        await createNotification(
          appDetail.candidate_id,
          "status_update",
          "Interview Selesai ✅",
          `Interview untuk ${jobTitle} di ${companyName} telah selesai. Semoga hasilnya memuaskan!`,
        );
      }

      if (status === "cancelled") {
        await createNotification(
          appDetail.candidate_id,
          "general",
          "Interview Dibatalkan",
          `Interview untuk ${jobTitle} di ${companyName} telah dibatalkan oleh HR. Nantikan info lebih lanjut.`,
        );
      }

      // Reschedule: status kembali ke scheduled dari cancelled
      if (status === "scheduled" && oldInterview.status === "cancelled") {
        const newDate = scheduled_at || oldInterview.scheduled_at;
        const { tanggal, jam } = formatSchedule(newDate);
        const tipe =
          (type || oldInterview.type) === "online" ? "Online" : "Onsite";

        await createNotification(
          appDetail.candidate_id,
          "interview",
          "Interview Dijadwalkan Ulang 🔄",
          `Interview ${tipe} untuk ${jobTitle} di ${companyName} telah dijadwalkan ulang pada ${tanggal} pukul ${jam} WIB.`,
        );
      }
    }
  }

  res.json(data);
};

// ── GET MY INTERVIEWS (untuk kandidat yang login) ──────────
exports.getMyInterviews = async (req, res) => {
  const { data: applications, error: appError } = await supabase
    .from("applications")
    .select("id, job_id, jobs(title, company_id, companies(name))")
    .eq("candidate_id", req.user.id);

  if (appError) return res.status(500).json({ error: appError.message });
  if (!applications || applications.length === 0) return res.json([]);

  const appIds = applications.map((a) => a.id);

  const { data: interviews, error } = await supabase
    .from("interviews")
    .select("*")
    .in("application_id", appIds)
    .order("scheduled_at", { ascending: true });

  if (error) return res.status(500).json({ error: error.message });

  const appMap = {};
  applications.forEach((a) => {
    appMap[a.id] = a;
  });

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
};
