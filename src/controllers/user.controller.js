import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {uploadOnColudinary} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

// generate access token
// generate refresh token
const generateAccessAndRefreshTokens = async (userId)=>{
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()

        // storing refresh token into database 
        user.refreshToken = refreshToken
        await user.save({validateBeforeSave: false})

        return {accessToken, refreshToken}

    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const registerUser = asyncHandler(async (req, res)=>{
    // res.status(200).json({
    //     message: "ok"
    // })

    // Steps

    // get user details from frontend
    // validation - not empty 
    // check if user already exists : username, email
    // check for images, check for avtar
    // upload them to cloudinary, avtar
    // create user object - create entry in db
    // remove password and refresh token filed from response
    // check for user creation 
    // return response 


    // get user details from frontend 
    console.log(req.body);
    const {username, email, fullname, password} = req.body;

    // validation - not empty
    if([username, email, fullname, password].some((field)=>{
        !field || field?.trim() === ""
    })){
        throw new ApiError(400, "All fields are required!!")
    }

    // check if user already exists : username, email
    const exitedUser = await User.findOne({
        $or: [{username}, {email}]
    })

    if(exitedUser){
        throw new ApiError(400, "User with email or username already exists!!")
    }

    // check for images, check for avtar
    const avatarFiles = req.files?.avatar
    const coverImageFiles = req.files?.coverImage
    if(!avatarFiles || avatarFiles.length === 0){
        throw new ApiError(400, "Please Upload avatar !!");
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = coverImageFiles && coverImageFiles.length > 0 ? coverImageFiles[0].path : null;

    console.log("Check image are uploaded or not ", coverImageLocalPath);

    if(!avatarLocalPath){
        throw new ApiError(400, "Please upload avatar !!")
    }
    
    // upload them to cloudinary, avtar
    const avatar = await uploadOnColudinary(avatarLocalPath)
    const coverImage = coverImageLocalPath ? await uploadOnColudinary(coverImageLocalPath) : {url : ""};
    console.log( avatar, coverImage);
    
    if(!avatar){
        throw new ApiError(400, "Please upload avatar !!")
    }

    // create user object - create entry in db
    const user = await User.create({
        username,
        email,
        fullname,
        avatar: avatar.url, 
        coverImage: coverImage?.url || "",
        password,
    })

    console.log(user);

    // remove password and refresh token filed from response
    const createdUser = await User.findById(user._id)

    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the data")
    }

    // return reponse 
    return res.status(200).json(
        new ApiResponse(201, createdUser, "User Data Registered Successfully !!")
    )
})


// log in functionality
const loginUser = asyncHandler(async (req, res)=>{
    // Steps 

    // get data from req.body
    // validation - username or email 
    // check if user exists
    // check password
    // generate access token
    // generate refresh token
    // send access token and refresh token - cookie 
    // return response


    // get data from req.body
    const {username, email, password} = req.body

    // validation - username or email
    if(!username && !email){
        throw new ApiError(400, "username or email is required")
    }

    // check if user exists
    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if(!user){
        throw new ApiError(404, "User not found")
    }

    // check password
    const isPasswordValid = await user.comparePassword(password)

    if(!isPasswordValid){
        throw new ApiError(401, "Invalid User Credentials")
    }

    // generate access and refresh tokens 
    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    // send access token and refresh token - cookie 
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    // return reponse
    return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User Logged In Successfully"     
        )
    )
})

// log out functionality 
const logoutUser = asyncHandler(async (req, res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {
            new: true,
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
        new ApiResponse(200, {}, "User Logged Out Successfully")
    )
})

const refreshAccessToken = asyncHandler(async (req, res) =>{

    // Take Incoming token from user 
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    // validate incoming Token 
    if(!incomingRefreshToken){
        throw new ApiError(401, "Unautorized request")
    }

    try {
        // Verify incoming token 
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
    
        // decoded token me se userId (token) fetch karne ka 
        const user = await User.findById(decodedToken?._id)
    
        // validate Fetch Userid (token)
        if(!user){
            throw new ApiError(401, "Invalid Refresh Token")
        }
    
        // check both token are match or not 
        if(incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Refresh token is expired or used")
        }
    
        const options = {
            httpOnly: true,
            secure: true
        }
    
        // if both tokens are match - generate new token
        const {accessToken, newRefreshToken} = await generateAccessAndRefreshTokens(user._id)
    
        // return response 
        return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newRefreshToken, options)
        .json(
            new ApiResponse(
                200,
                {accessToken, refreshToken : newRefreshToken},
                "Access Token Refreshed Successfully"
            )
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid Refresh Token")
    }
})

// change password 
const changeCurrentPassword = asyncHandler(async (req, res) =>{
    const {oldPassword, newPassword} = req.body

    const user = await User.findById(req.user?._id)

    const isPasswordCorrect = await user.comparePassword(oldPassword)

    if(!isPasswordCorrect){
        throw new ApiError(401, "Old password is incorrect")
    } 

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed Successfully"))
})

// get current user 
const getCurrentUser = asyncHandler(async (req, res)=>{
    return res
    .status(200)
    .json(200, req.user, "Current User Fetched Successfully")
})

// to edit text details 
const updateAccountDetails = asyncHandler(async (req, res) =>{
    const {fullname, email} = req.body

    if(!fullname || !email){
        throw new ApiError(400, "Please provide fullname and email")
    }

    await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname, // we can do also like this -- fullname: fullname
                email
            }
        },
        {
            new: true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updates Successfully !!"))

})

// update user Avatar 
const updateUserAvatar = asyncHandler(async (req, res) =>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400, "Avatar file is missing")
    }

    const avatar = await uploadOnColudinary(avatarLocalPath)

    if(!avatar){
        throw new ApiError(400, "Avatar file is missing")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated Successfully"))
})

// update user Cover Image 
const updateUserCoverImage = asyncHandler(async (req, res) =>{
    const coverImageLocalFile = req.file?.path

    if(!coverImageLocalFile){
        throw new ApiError(400, "Cover Image is missing")
    }

    // first of delete previous cover image before it update 

    const coverImage = await uploadOnColudinary(coverImageLocalFile)

    if(!coverImage){
        throw new ApiError(400, "Cover Image is missing")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image updated Successfully"))
})

// to get subscriber and subscribeTo from Subscription Model 
const getUserChannelProfile = asyncHandler(async (req, res)=>{
    const {username} = req.params
    
    if(!username?.trim()){
        throw new ApiError(400, "Username is missing")
    }

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscibersCount: {
                    $size: "$subscribers"
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false 
                    }
                }
            }
        },
        {
            $project: {
                fullname : 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                subscibersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ])

    if(!channel?.length){
        throw new ApiError(404, "Channel does not exists")
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
    )
})

const getWatchHistory = asyncHandler(async (req, res)=>{
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId.createFromHexString(req.user._id),
            }
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        fullname: 1,
                                        username: 1,
                                        avatar: 1
                                    },
                                }
                            ]
                        }
                    },
                    {
                        $addFields :{
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ])
})

return res
.status(200)
.json(
    new ApiResponse(
        200, 
        user[0].watchHistory, 
        "Watch History fetched successfully"
    )
)

export {
    registerUser, 
    loginUser, 
    logoutUser, 
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}