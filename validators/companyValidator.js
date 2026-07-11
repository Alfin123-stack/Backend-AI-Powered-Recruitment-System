const { z } = require("zod");

const createCompanySchema = z
  .object({
    name: z.string().min(1, "Nama perusahaan wajib diisi").max(200),
    description: z.string().max(5000).optional(),
    company_size: z.string().max(50).optional(),
  })
  .strict();

// updateCompany di controller mewajibkan `name` juga (bukan partial update),
// jadi skema update sama persis dengan create -- bukan .partial().
const updateCompanySchema = createCompanySchema;

module.exports = { createCompanySchema, updateCompanySchema };
