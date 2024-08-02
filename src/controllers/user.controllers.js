import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"

const generateAccessTokenAndRefreshToken = async (userId) => {
    try {
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, "User not found")
        }

        const accessToken =  user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // save refresh token in db
        user.refreshToken = refreshToken
        await user.save({
            validateBeforeSave: false
        })

        return {
            accessToken,
            refreshToken
        }   
    } catch (error) {
        console.error("Error in generateAccessTokenAndRefreshToken:", error);
        throw new ApiError(500, "Something went wrong while generating accesstoken and refreshtoken")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    // validation - not empty
    // check if user already exists: username, email
    // check for images, check for avatar
    // upload them to cloudinary, avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation
    // return res

    const { username, email, password, fullName } = req.body;

    if ([username, email, password, fullName].includes("")) {
        throw new ApiError(400, "Please provide all values")  
    }

    const existingUser = await User.findOne(
        {
            $or: [
                { username },
                { email }
            ]
        }
    )

    if (existingUser) {
        throw new ApiError(409, "User already exists")
    }

    const avatarImageLocalPath = req.files?.avatar[0]?.path
    // const coverImageLocalPath = req.files?.coverImage[0]?.path

    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        coverImageLocalPath = req.files.coverImage[0].path
    }

    if (!avatarImageLocalPath) {
        throw new ApiError(400, "Please provide avatar image")
    }

    const avatar = await uploadOnCloudinary(avatarImageLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    if (!avatar) {
        throw new ApiError(500, "Avatar image upload failed")
    }

    const user = await User.create({
        username,
        email,
        password,
        fullName,
        avatar : avatar.url,
        coverImage : coverImage?.url || ""
    })

    const checkUser = await User.findById(user._id).select("-password -refresshToken")

    if (!checkUser) {
        throw new ApiError(500, " Something went wrong while creating user")
    }

    return res.status(201).json(
        new ApiResponse(200, checkUser, "User created successfully")
    )
})

const loginUser = asyncHandler(async (req, res) => {
    // get data from req.body
    // username, password is exist or not
    // check if user exists
    // check if password is correct
    // generate access token
    // generate refresh token
    // return res

    const { username, email, password } = req.body;

    if (!(username || email)) {
        throw new ApiError(400, "Please provide all values")  
    }

    const user = await User.findOne(
        {
            $or: [
                { username },
                { email }
            ]
        }
    )

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid credentials")
    }

    const { accessToken, refreshToken } = await generateAccessTokenAndRefreshToken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refresshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    if (process.env.NODE_ENV === "production") {
        options.secure = true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                { loggedInUser , accessToken, refreshToken },
                "User logged in successfully"
            )
        )
})

const logoutUser = asyncHandler(async (req, res) => {
    await User.findOneAndUpdate(
        {
            _id: req.user._id
        },
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )
    
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(
            200,
            null,
            "User logged out successfully"
        )
    )
})


const refreshAccessToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
        throw new ApiError(401, "Unauthorized")
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN)
    
        const user = await User.findById(decoded?._id)
    
        if (!user) {
            throw new ApiError(404, "User not found")
        }
    
        if (user.refreshToken !== refreshToken) {
            throw new ApiError(401, "Unauthorized")
        }
    
        const { accessToken, newRefreshToken } = await generateAccessTokenAndRefreshToken(user._id)
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token and refresh token generated successfully"
                )
            )
    
    } catch (error) {
        throw new ApiError(401, error?.message || "Unauthorized")
    }
})


export { registerUser, loginUser , logoutUser, refreshAccessToken }