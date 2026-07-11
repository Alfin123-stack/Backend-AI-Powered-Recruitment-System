const supabase = require("../config/supabase");

// ── GET analisis CV terakhir milik user ───────────────────
exports.getLatestAnalysis = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from("cv_analysis")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return next(error);

    res.json(data || null);
  } catch (err) {
    next(err);
  }
};

// ── SAVE hasil analisis CV ─────────────────────────────────
exports.saveAnalysis = async (req, res, next) => {
  try {
    const {
      resume_score,
      ats_score,
      overall_score,
      impact_score,
      readability_score,
      experience_level,
      job_title,
      ai_summary,
      extracted_skills,
      categories,
      strengths,
      improvements,
      ats_checks,
      line_feedback,
      writing_suggestions,
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
          impact_score: impact_score || null,
          readability_score: readability_score || null,
          experience_level: experience_level || null,
          job_title: job_title || null,
          ai_summary: ai_summary || null,
          extracted_skills: extracted_skills || [],
          categories: categories || [],
          strengths: strengths || [],
          improvements: improvements || [],
          ats_checks: ats_checks || null,
          line_feedback: line_feedback || null,
          writing_suggestions: writing_suggestions || null,
          file_name: file_name || null,
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
