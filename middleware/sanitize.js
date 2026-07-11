const xss = require("xss");

// FIX (security): sanitasi semua string di req.body secara rekursif.
// Field bebas seperti `description`, `notes`, `cover_letter`, dsb sering
// ditampilkan lagi di frontend -- kalau user isi tag <script> atau HTML
// berbahaya, ini dibersihkan sebelum masuk ke controller/DB (stored XSS).
//
// Dipasang GLOBAL (setelah express.json(), sebelum routes) supaya semua
// endpoint otomatis terlindungi, tidak perlu diingat satu-satu per field.
function sanitizeValue(value) {
  if (typeof value === "string") {
    return xss(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value)) {
      result[key] = sanitizeValue(value[key]);
    }
    return result;
  }
  return value;
}

module.exports = (req, res, next) => {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeValue(req.body);
  }
  next();
};
