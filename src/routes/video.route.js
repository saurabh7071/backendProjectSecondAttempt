import {Router} from "express"
import { 
        getAllVideos,
        publishAVideo,
        getVideoById,
        updateVideo,
        updateThumbnail,
        deleteVideo,
        togglePublicStatus

    } from "../controllers/video.controller.js"
import { verifyJWT } from "../middlewares/auth.middleware.js"
import { upload } from "../middlewares/multer.middleware.js"


const router = Router()
router.use(verifyJWT)

router.route("/all-videos").get(getAllVideos)
router.route("/publishVideo").post(
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1
        },
        {
            name: "thumbnail",
            maxCount: 1
        }
    ]), publishAVideo)

router.route("/:videoId").get(getVideoById).delete(deleteVideo)
router.route("/update-video/:videoId").patch(upload.single("videoFile"), updateVideo)
router.route("/update-thumbnail/:videoId").patch(upload.single("thumbnail"), updateThumbnail)
router.route("/toggle/publish/:videoId").patch(togglePublicStatus)

export default router 