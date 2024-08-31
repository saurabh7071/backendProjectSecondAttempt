import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {uploadOnColudinary} from "../utils/cloudinary.js";
import jwt from "jsonwebtoken";

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

export {registerUser, loginUser, logoutUser, refreshAccessToken}