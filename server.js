require("dotenv").config()

const express = require("express")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require("express-rate-limit")

const authRoutes = require("./routes/authRoutes")
const jobRoutes = require("./routes/jobRoutes")
const aiRoutes = require("./routes/aiRoutes")
const applicationRoutes = require("./routes/applicationRoutes")

const app = express()

app.use(cors())
app.use(express.json())
app.use(helmet())

const limiter = rateLimit({
 windowMs: 15 * 60 * 1000,
 max: 100
})

app.use(limiter)

app.use("/api/auth", authRoutes)
app.use("/api/jobs", jobRoutes)
app.use("/api/ai", aiRoutes)
app.use("/api/applications", applicationRoutes)

app.listen(process.env.PORT, () => {
 console.log("Server running on port", process.env.PORT)
})