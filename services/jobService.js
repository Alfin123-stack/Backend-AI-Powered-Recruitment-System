const jobRepository = require("../repositories/jobRepository");
const companyRepository = require("../repositories/companyRepository");
const { ForbiddenError, ValidationError, NotFoundError } = require("../utils/errors");

// FIELD YANG BOLEH DIUBAH LEWAT updateJob (whitelist, cegah mass assignment)
const JOB_UPDATABLE_FIELDS = [
  "title",
  "description",
  "requirements",
  "salary",
  "location",
  "type",
  "skills",
  "benefits",
  "deadline",
  "is_active",
];

function pickUpdatableFields(body) {
  const result = {};
  for (const key of JOB_UPDATABLE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      result[key] = body[key];
    }
  }
  return result;
}

async function createJob(hrId, payload) {
  const { title } = payload;
  if (!title) throw new ValidationError("Title wajib diisi");

  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError("HR belum memiliki company, buat company terlebih dahulu");

  const { title: t, description, requirements, salary, location, type, skills, benefits, deadline } = payload;

  const { data, error } = await jobRepository.insert(company.id, {
    title: t,
    description,
    requirements,
    salary,
    location,
    type: type || "Full-time",
    skills: skills || [],
    benefits: benefits || [],
    deadline: deadline || null,
  });
  if (error) throw error;

  return data;
}

async function getJobs() {
  const { data, error } = await jobRepository.findAllActive();
  if (error) throw error;
  return data;
}

async function getJobById(id) {
  const { data, error } = await jobRepository.findActiveById(id);
  if (error && error.code === "PGRST116") throw new NotFoundError("Lowongan tidak ditemukan");
  if (error) throw error;
  return data;
}

async function updateJob(hrId, id, payload) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError();

  // FIX (security): jangan pernah update(req.body) mentah -- mass assignment.
  // Hanya field di JOB_UPDATABLE_FIELDS yang boleh diubah lewat endpoint ini.
  const updates = pickUpdatableFields(payload);
  if (Object.keys(updates).length === 0) {
    throw new ValidationError("Tidak ada field valid untuk diupdate");
  }

  const { data, error } = await jobRepository.updateByIdAndCompany(id, company.id, updates);
  if (error) throw error;

  return data;
}

async function deleteJob(hrId, id) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) throw new ForbiddenError();

  const { error } = await jobRepository.softDeleteByIdAndCompany(id, company.id);
  if (error) throw error;

  return { message: "Lowongan berhasil ditutup" };
}

async function getMyJobs(hrId) {
  const company = await companyRepository.findByHrId(hrId);
  if (!company) return [];

  const { data, error } = await jobRepository.findAllByCompanyId(company.id);
  if (error) throw error;

  return data;
}

module.exports = { createJob, getJobs, getJobById, updateJob, deleteJob, getMyJobs };
