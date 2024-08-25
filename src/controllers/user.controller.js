import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import {uploadOnColudinary} from "../utils/cloudinary.js";

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

export {registerUser};