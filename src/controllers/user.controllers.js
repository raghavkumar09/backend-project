import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import jwt from "jsonwebtoken"
import mongoose from "mongoose";

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

const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id)
    
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);
    
    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old password is incorrect")
    }
    
    user.password = newPassword
    await user.save()
    
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                null,
                "Password changed successfully"
            )
        )       
})

const currentUser = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id)
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "User fetched successfully"
            )
        )
})

const accountDetailsUpdate = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body

    if (!fullName || !email) {
        throw new ApiError(400, "Please provide all values")
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            fullName,
            email
        }
    }, {
        new: true // return updated user
    })

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Account details updated successfully"
            )
        )
})

const updateAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path

    if (!avatarLocalPath) {
        throw new ApiError(400, "Please provide avatar")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)

    // delete old avatar - pending

    if (!avatar.url) {
        throw new ApiError(400, "Avatar upload failed")
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            avatar: avatar.url
        }
    }, {
        new: true // return updated user
    }).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Avatar updated successfully"
            )
        )
})

const updateCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Please provide cover image")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // delete old cover image

    if (!coverImage.url) {
        throw new ApiError(400, "Cover image upload failed")
    }

    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            coverImage: coverImage.url
        }
    }, {
        new: true // return updated user
    }).select("-password")

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user,
                "Cover image updated successfully"
            )
        )
})

/** getUserChannelProfile
 @param {string} username
 @returns {Promise<User>}
 @throws {ApiError}
 @database 
    @aggregate
        @match - that take to match username
        @lookup - to get subscribers and subscribedTo
        @addFields - to add subscribersCount and subscribedToCount and isSubscribed to the user
        @project - to project only username, subscribersCount, subscribedToCount, isSubscribed fields that visible to user
 **/
const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params

    if (!username?.trim()) {
        throw new ApiError(400, "Missing username")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "Subscription",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $condition: {
                        if: {
                            $in: [
                                req.user?._id,
                                "$subscribers.subscriber"
                            ]
                        },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if (!channel?.length) {
        throw new ApiError(404, "Channel not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                channel[0],
                "Channel profile fetched successfully"
            )
        )
})

/** getWatchHistory
 @param {string} username
 @returns {Promise<User>}
 @throws {ApiError}
 @database 
    @aggregate
        @match - that take to match username
        @lookup - to get subscribers and subscribedTo
        @addFields - to add owner field and send object instead of array
        @project - to project only username, subscribersCount, subscribedToCount, isSubscribed fields that visible to user
 **/
const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup: {
                from: "Video",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "User",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullName: 1,
                                        username: 1,
                                        avatar: 1
                                    }
                                }
                            ]
                        }
                    },
                    {
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }   
                        }
                    }
                ]
            }
        }
    ])

    if (!user?.length) {
        throw new ApiError(404, "User not found")
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                user[0].watchHistory,
                "Watch history fetched successfully"
            )
        )
})

export { 
    registerUser, 
    loginUser , 
    logoutUser, 
    refreshAccessToken, 
    changePassword, 
    currentUser,
    accountDetailsUpdate,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile,
    getWatchHistory
}