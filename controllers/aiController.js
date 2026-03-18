const extractText = require("../utils/pdfExtractor")
const analyzeResume = require("../services/geminiService")

exports.analyze = async (req, res) => {

const file = req.file
const jobDescription = req.body.jobDescription

const text = await extractText(file.buffer)

const result = await analyzeResume(text, jobDescription)

res.json(result)

}