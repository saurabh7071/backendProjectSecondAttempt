import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) =>{
    res.status(200).json({
        message: "ok"
    })
})

export { toggleSubscription }