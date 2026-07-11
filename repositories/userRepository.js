const supabase = require("../config/supabase");

async function findByIds(ids) {
  const { data } = await supabase
    .from("users")
    .select("id, full_name, email")
    .in("id", ids);
  return data || [];
}

async function findById(id) {
  const { data } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", id)
    .single();
  return data;
}

module.exports = { findByIds, findById };
