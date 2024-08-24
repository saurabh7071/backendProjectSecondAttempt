import express from "express"
import cors from "cors"
// cookie parser - npm i cookie-parser

const app = express()

app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
}))

app.use(express.json({limit: "16kb"}));
app.use(express.urlencoded({ extended: true }));
// express.static
// cookie parser


// route import
import userRouter from "./routes/user.route.js"

// route declaration 
app.use("/api/v1/users", userRouter);

// http://localhost:5000/api/v1/users/register

export {app}