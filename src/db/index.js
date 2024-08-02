import 'dotenv/config'
import mongoose from "mongoose";
import { DB_NAME } from "../constents.js";


const connectionDB = async () => {
    try {
        const conn = await mongoose.connect(`${process.env.MONGO_URI}/${DB_NAME}`)
        console.log(`MongoDB Connected: ${conn.connection.host}`)
    } catch (error) {
        console.log("Error in connection DB", error)
        process.exit(1)
    }
}

export default connectionDB