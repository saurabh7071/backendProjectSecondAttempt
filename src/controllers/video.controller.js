import { asyncHandler } from "../utils/asyncHandler.js"
import { Video } from "../models/videos.model.js"
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js"

const getAllVideos = asyncHandler(async (req, res) =>{
    console.log(req.query);
    
    // destructing query parameters with default 
    const {
            page = 1, 
            limit = 10, 
            query= '', 
            sortBy= 'createdAt', 
            sortType= 'desc', 
            userId
        } = req.query
    
    // To get all the videos based on query, sort, pagination
    
    // paginaion logic (conver to number)
    const pageNum = Number(req.query.page) || 1;
    const limitNum = Number(req.query.limit) || 10;

    const skip = (pageNum - 1) * limitNum;

    // Building the filter object for the query
    const filter = {}

    if (query) {
        filter.title = {$regex: query, $options: 'i'}
    }
    if (userId) {
        filter.owner = userId
    }

    // Sorting logic (based on field and type)
    const sortOptions = {[sortBy]: sortType === 'asc'? 1 : -1}

    // Fetching videos from the database 
    const videos = await Video
                            .find(filter)
                            .sort(sortOptions)
                            .skip(skip)
                            .limit(limitNum)

    // getting total count for pagination 
    const totalVideos = await Video.countDocuments(filter)
    const totalPages = Math.ceil(totalVideos / limitNum)

    // sending response 
    res.status(200).json({
        page: pageNum,
        totalPages,
        totalVideos,
        videos
    })
})

const publishAVideo = asyncHandler(async (req, res) =>{
    // get video detail from frontend 
    const {title, description} = req.body

    // TODO: get video, upload to cloudinary, create video

    // validate 
    if([title, description].some((field)=>{
        !field || field?.trim() === "" 
    })){
        throw new ApiError(400, "All fields are required!!")
    }

    // check for videoFile and thumbnail 
    const videoFile = req.files?.videoFile
    const thumbnailFile = req.files?.thumbnail

    if(!videoFile || !thumbnailFile){
        throw new ApiError(400, "Video file and thumbnail are required!!")
    }

    const videoFileLocalPath = req.files?.path[0].videoFile
    const thumbnailLocalPath = req.files?.path[0].thumbnail

    console.log("Video File Path:", videoFileLocalPath);
    console.log("Thumbnail File Path:", thumbnailLocalPath);

    if(!videoFileLocalPath || !thumbnailLocalPath){
        throw new ApiError(400, "Video file and thumbnail are required!!")
    }

    // upload them to cloudinary
    const video = await uploadOnCloudinary(videoFileLocalPath)
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    console.log(video, thumbnail);

    if(!video || !thumbnail){
        throw new ApiError(400, "Failed to upload video or thumbnail to Cloudinary!");
    }

    // extract video duration from the cloudinary upload response 
    const duration = video?.duration;

    if(!duration){
        throw new ApiError(400, "Failed to extract video duration from Cloudinary!")
    }

    // create object - entry in db 
    const videoObject = {
        title,
        description,
        duration,
        videoFile: video.url,
        thumbnail: thumbnail.url,
        owner: req.user._id     // Owner is the logged in user 
    }
    
    console.log(videoObject);

    //save the video object to the database 
    const newVideo = await Video.create(videoObject)

    res.status(200).json(
        new ApiResponse(201, newVideo, "Video Uploaded Successfully!!")
    )
})

const getVideoById = asyncHandler(async (req, res) =>{
    const {videoId} = req.params
    //TODO: get video by id
    try {
        const video = await Video.findById(videoId).populate('owner', 'username email')
    
        if(!video){
            throw new ApiError(404, "Video not found!!")
        }

        return res
        .status(200)
        .json(201, video, "Video Fetched by Id")

    } catch (error) {
        throw new ApiError(500, error?.message || "Video not found")
    }
})

const updateVideo = asyncHandler(async (req, res) =>{
    const {videoId} = req.params
    //TODO: update video details like title, description
    const { title, description } = req.body

    if(!title || !description){
        throw new ApiError(400, "All fields are required!!")
    }

    const updatedDetails = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                title,
                description
            }
        },
        {
            new: true, runValidators: true
        }
    )

    if(!updatedDetails){
        throw new ApiError(404, "Video not found!!")
    }

    return res
    .status(200)
    .json(201, updatedDetails, "Video Details Updated Successfully!!")

})

const updateThumbnail = asyncHandler(async (req, res) =>{
    const {videoId} = req.params
    // fetch the video deta to get the url of the existing thumnail
    const thumbnailLocalPath = req.file?.path

    // validation
    if(!thumbnailLocalPath){
        throw new ApiError(400, "Thumbnail file is missing")
    }

    // Fetch the video details from the database to get the current thumbnail url 
    const video = await Video.findById(videoId).select("thumbnail")

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    // upload new thumbnail to cloudinary 
    const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath)

    if(!newThumbnail){
        throw new ApiError(400, "Thumbnail file is missing")
    }

    // if there is a previous avatar and it's not the same, delete it from cloudinary 
    if(video.thumbnail){
        const publicId = getPublicIdFromUrl(video.thumbnail)
        await deleteFromCloudinary(publicId)
    }

    // update the thumbnail in the database 
    const updatedThumbnail = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                thumbnail: newThumbnail.url
            }
        },
        {
            new: true
        }
    )

    return res
    .status(200)
    .json(new ApiResponse(200, updatedThumbnail, "Thumbnail updated successfully"))
})

const deleteVideo = asyncHandler(async (req, res) =>{
    const {videoId} = req.params

    // Fetch the video details from the database to get Cloudinary URLs
    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    // Extract Cloudinary urls (videoFile and thumbnail)
    const videoFileUrl = video.videoFile
    const thumbnailUrl = video.thumbnail

    // Delete the videoFile from Cloudinary 
    if(videoFileUrl){
        const publicId = getPublicIdFromUrl(videoFileUrl)
        await deleteFromCloudinary(publicId)
    }

    // Delete thumbnail from Cloudinary 
    if(thumbnailUrl){
        const publicId = getPublicIdFromUrl(thumbnailUrl)
        await deleteFromCloudinary(publicId)
    }

    // delete the video record from the database 
    await Video.deleteOne()

    return res
    .status(200)
    .json(new ApiResponse(200, null, "Video Deleted Successfully"))

})

const togglePublicStatus = asyncHandler(async (req, res) => {
    const {videoId} = req.params

    const video = await Video.findById(videoId)

    if(!video){
        throw new ApiError(404, "Video not found")
    }

    video.isPublished = !video.isPublished

    await video.save()

    return res
    .status(200)
    .json({
        message: `video is now ${video.isPublished ? 'published' : 'unpublished'}`, 
        video
    })

})

function getPublicIdFromUrl(url){
    const parts = url.split('/')
    const publicIdWithExtension = parts[parts.length-1];
    const publicId = publicIdWithExtension.split('.')[0];
    return publicId
}

export {getAllVideos,
        publishAVideo,
        getVideoById,
        updateVideo,
        updateThumbnail,
        deleteVideo,
        togglePublicStatus
    }