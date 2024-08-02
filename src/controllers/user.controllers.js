import { asyncHandler } from "../utils/asyncHandler.js";
import User from "../models/user.models.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

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
    const coverImageLocalPath = req.files?.coverImage[0]?.path

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


export { registerUser }