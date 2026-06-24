const supabase = require("../config/supabase");

/**
 * Cari knowledge base yang relevan berdasarkan pesan user dan role
 * @param {string} userMessage
 * @param {string} role - 'hr' | 'candidate'
 * @returns {Promise<Array>}
 */
async function findRelevantKnowledge(userMessage, role) {
  try {
    // Ekstrak kata kunci dari pesan (min 3 karakter)
    const words = userMessage
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    if (words.length === 0) return [];

    const { data, error } = await supabase
      .from("knowledge_base")
      .select("question, answer, topic, category")
      .eq("is_active", true)
      .in("role_access", ["all", role])
      .overlaps("keywords", words)
      .limit(5);

    if (error) {
      console.error("Knowledge base query error:", error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("findRelevantKnowledge error:", err.message);
    return [];
  }
}

module.exports = { findRelevantKnowledge };
