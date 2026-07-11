const companyRepository = require("../repositories/companyRepository");
const jobRepository = require("../repositories/jobRepository");
const { ValidationError, ConflictError, NotFoundError } = require("../utils/errors");

function deriveLocationAndTags(activeJobs) {
  const location = activeJobs[0]?.location?.split("/")[0]?.trim() || null;
  const tags = [...new Set(activeJobs.flatMap((j) => (j.skills || []).slice(0, 2)))].slice(0, 3);
  return { location, tags };
}

async function getMyCompany(hrId) {
  const { data, error } = await companyRepository.findFullByHrId(hrId);
  if (error && error.code === "PGRST116") return null;
  if (error) throw error;
  return data;
}

async function createCompany(hrId, payload) {
  const { name, description, company_size } = payload;
  if (!name?.trim()) throw new ValidationError("Nama perusahaan wajib diisi");

  const existing = await companyRepository.findByHrId(hrId);
  if (existing) throw new ConflictError("HR sudah memiliki perusahaan");

  const { data, error } = await companyRepository.insert(hrId, {
    name: name.trim(),
    description: description?.trim() || null,
    company_size: company_size || null,
  });
  if (error) throw error;

  return data;
}

async function updateCompany(hrId, payload) {
  const { name, description, company_size } = payload;
  if (!name?.trim()) throw new ValidationError("Nama perusahaan wajib diisi");

  const { data, error } = await companyRepository.updateByHrId(hrId, {
    name: name.trim(),
    description: description?.trim() || null,
    company_size: company_size || null,
  });
  if (error) throw error;

  return data;
}

async function getPublicCompanies() {
  const { data, error } = await companyRepository.findAllWithJobs();
  if (error) throw error;

  return data
    .map((c) => {
      const activeJobs = (c.jobs || []).filter((j) => j.is_active);
      if (activeJobs.length === 0) return null;

      const { location, tags } = deriveLocationAndTags(activeJobs);

      return {
        id: c.id,
        name: c.name,
        description: c.description,
        company_size: c.company_size,
        logo_url: c.logo_url,
        website: null,
        verified: false,
        openJobs: activeJobs.length,
        location,
        tags,
      };
    })
    .filter(Boolean);
}

async function getCompanyById(id) {
  const { data: company, error: companyError } = await companyRepository.findPublicById(id);
  if (companyError && companyError.code === "PGRST116") {
    throw new NotFoundError("Perusahaan tidak ditemukan");
  }
  if (companyError) throw companyError;

  const { data: jobs, error: jobsError } = await jobRepository.findActiveDetailedByCompanyId(id);
  if (jobsError) throw jobsError;

  const activeJobs = jobs || [];
  const { location, tags } = deriveLocationAndTags(activeJobs);

  return {
    company: {
      ...company,
      location,
      tags,
      openJobs: activeJobs.length,
      website: null, // kolom belum ada di tabel -- tambah migrasi jika perlu
      verified: false, // kolom belum ada di tabel -- tambah migrasi jika perlu
    },
    jobs: activeJobs,
  };
}

module.exports = { getMyCompany, createCompany, updateCompany, getPublicCompanies, getCompanyById };
