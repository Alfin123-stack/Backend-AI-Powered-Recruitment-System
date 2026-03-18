const supabase = require("../config/supabase");

exports.createJob = async (req, res) => {
  const { title, description, requirements, skills } = req.body;

  const { data, error } = await supabase.from("jobs").insert([
    {
      title,
      description,
      requirements,
      skills,
    },
  ]);

  if (error) {
    return res.status(500).json(error);
  }

  res.json(data);
};
