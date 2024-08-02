import User from "../models/user.models.js"
import { ApiError } from "../utils/ApiError.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import jwt from "jsonwebtoken"


const verifyToken = asyncHandler( async (req, res, next) => {
    try {
        const token = req.cookies?.accessToken || req.header("Authorization").replace("Bearer ", "")

        if(!token){
            throw new ApiError(401, "Unauthorized")
        }
    
        const decodeToken = jwt.verify(token, process.env.ACCESS_TOKEN)
    
        const user = await User.findById(decodeToken?._id).select("-password -refreshToken")
    
        if(!user){
            throw new ApiError(401, "Invailid access token")
        }
    
        req.user = user
        next()
    } catch (error) {
        console.error("Error in verifyToken:", error);
        throw new ApiError(401, "Unauthorized")
    }
})


export { verifyToken }