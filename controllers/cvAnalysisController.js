const supabase = require("../config/supabase");

// ── GET analisis CV terakhir milik user ───────────────────
exports.getLatestAnalysis = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("cv_analysis")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: error.message });

    res.json(data || null);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── SAVE hasil analisis CV standalone ─────────────────────
exports.saveAnalysis = async (req, res) => {
  try {
    const {
      resume_score,
      ats_score,
      overall_score,
      extracted_skills,
      categories,
      strengths,
      improvements,
      file_name,
    } = req.body;

    const { data, error } = await supabase
      .from("cv_analysis")
      .insert([
        {
          user_id: req.user.id,
          resume_score,
          ats_score,
          overall_score,
          extracted_skills: extracted_skills || [],
          categories: categories || [],
          strengths: strengths || [],
          improvements: improvements || [],
          file_name: file_name || null,
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
