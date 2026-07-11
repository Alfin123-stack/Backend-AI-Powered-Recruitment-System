const { z } = require("zod");

// .strict() -> field yang TIDAK ada di skema ini otomatis DITOLAK.
// Ini sekaligus jadi solusi mass-assignment (menggantikan whitelist manual
// di jobController, tapi whitelist di controller tetap dipertahankan sebagai
// lapisan kedua / defense-in-depth).
const createJobSchema = z
  .object({
    title: z.string().min(1, "Title wajib diisi").max(200),
    description: z.string().max(5000).optional(),
    requirements: z.string().max(5000).optional(),
    salary: z.string().max(100).optional(),
    location: z.string().max(200).optional(),
    type: z.enum(["Full-time", "Part-time", "Contract", "Internship"]).optional(),
    skills: z.array(z.string().max(50)).max(30).optional(),
    benefits: z.array(z.string().max(100)).max(30).optional(),
    deadline: z.string().optional(),
  })
  .strict();

// updateJob boleh partial (tidak semua field wajib dikirim tiap kali update)
const updateJobSchema = createJobSchema.partial().extend({
  is_active: z.boolean().optional(),
});

module.exports = { createJobSchema, updateJobSchema };
