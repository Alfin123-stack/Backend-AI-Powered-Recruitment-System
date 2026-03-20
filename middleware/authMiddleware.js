import { supabase } from "../config/supabase.js";

export const verifyUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ message: "No token" });
    }

    // 🔐 ambil user dari Supabase Auth
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const authUser = data.user;

    // 🔥 INI BAGIAN PENTING (ambil dari tabel users kamu)
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (profileError) {
      return res.status(404).json({ message: "User profile not found" });
    }

    // gabungkan data auth + database
    req.user = {
      ...authUser,
      ...profile,
    };

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
