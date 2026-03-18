const supabase = require("../config/supabase");

exports.applyJob = async (req, res) => {
  const { user_id, job_id, cv_url } = req.body;

  const { data, error } = await supabase.from("applications").insert([
    {
      user_id,
      job_id,
      cv_url,
      status: "pending",
    },
  ]);

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
};
