import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'

// create express app
const app = express()

// middlewares
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static('public'))
app.use(cookieParser())


// import routes
import userRoutes from './routes/user.routes.js'

// use routes
// expample - http://localhost:3000/api/v1/users/register
app.use('/api/v1/users', userRoutes)




export { app }