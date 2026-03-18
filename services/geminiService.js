const { GoogleGenerativeAI } = require("@google/generative-ai")

const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY)

async function analyzeResume(cvText, jobDescription) {

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

const prompt = `
Analyze this CV and job description.

Return JSON:

{
resume_score: number,
matching_score: number,
skills: [],
recommendations: []
}

CV:
${cvText}

Job:
${jobDescription}
`

const result = await model.generateContent(prompt)

return result.response.text()

}

module.exports = analyzeResume