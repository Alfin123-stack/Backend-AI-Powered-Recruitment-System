const { z } = require("zod");

// Struktur `analysis` mengikuti hasil dari geminiService.analyzeResume(),
// bukan input bebas dari user -- tetap divalidasi agar shape-nya konsisten
// sebelum ditulis ke tabel resume_analysis.
const analysisSchema = z
  .object({
    resumeScore: z.number().min(0).max(100).optional(),
    matchingScore: z.number().min(0).max(100).optional(),
    atsScore: z.number().min(0).max(100).optional(),
    overallScore: z.number().min(0).max(100).optional(),
    skills: z.array(z.string()).optional(),
    categories: z.record(z.string(), z.unknown()).optional(),
    strengths: z.array(z.string()).optional(),
    improvements: z.array(z.string()).optional(),
  })
  .passthrough(); // objek ini kompleks & berasal dari hasil AI, jangan strict dulu

const applyJobSchema = z
  .object({
    job_id: z.string().uuid("job_id harus UUID valid"),
    cv_url: z.string().url("cv_url harus URL valid").optional(),
    analysis: analysisSchema.optional(),
  })
  .strict();

module.exports = { applyJobSchema };
