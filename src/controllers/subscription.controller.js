import { asyncHandler } from "../utils/asyncHandler.js";
import { Subscription } from "../models/subscription.model.js"
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleSubscription = asyncHandler(async (req, res) =>{
    const { channelId } = req.params
    //ToDo: Toggle Subscription 
    const subscriberId = req.user._id;

    console.log(channelId, subscriberId);

    if(subscriberId === channelId){
        throw new ApiError(400, "You cannot subscribe to your own channel")
    }

    // check if the subscription already exists 
    const subscription = await Subscription.findOne({
        subscriber: subscriberId,
        channel: channelId
    })

    if(subscription) {
        // if already subscribed, unsubscribe
        await Subscription.deleteOne({_id: subscription._id})
        
        return res
        .status(200)
        .json(new ApiResponse(201, {isSubscribed: false}, "Unsubscribed Successfully"))

    }else{
        // if not subscribed, create a new subscription
        const newSubscription = await Subscription.create({
            subscriber: subscriberId,
            channel: channelId
        })

        return res
        .status(200)
        .json(new ApiResponse(201, {isSubscribed: true, subscription: newSubscription}, "Subscribed Successfully"))

    }

})

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res)=>{
    const { subscriberId } = req.params

    if(!subscriberId){
        throw new ApiError(400, "Subscriber Id is required")
    }

    // find all the subscribers for the given channel
    const subscriptions = await Subscription.find({ subscriber: subscriberId })
    .populate('subscriber', 'username email')
    .exec()

    if(subscriptions.length === 0){
        return res
        .status(200)
        .json(new ApiResponse(201, {subscribers: []}, "No Subscribers found for this channel"))
    } 

    // return the list of subscribers
    return res
    .status(200)
    .json(new ApiResponse(201, {subscribers: subscriptions.map(sub => sub.subscriber)}, "Subscribers for channel"))
})

// controller to return channel list to which user has subscribed 
const getSubscribedChannels = asyncHandler(async (req, res) =>{
    const { channelId } = req.params

    if(!channelId){
        throw new ApiError(400, "Subscriber Id is required")
    }

    // find all channels that the user (subscriber) has subscribed to
    const subscriptions = await Subscription.find({channel: channelId})
    .populate('channel', 'channelName username email')
    .exec() // execute the query and return a promise that resolves to a cursor. The cursor is an object that contains the results of the query. The results are stored in the `docs` property of the cursor.

    if(subscriptions.length === 0){
        return res.status(200).json(new ApiResponse(201, {channels: []}, "This user has not subscribed to any channel"))
    }

    // return list of subscribed channel
    return res.status(200).json(new ApiResponse(201, {channels: subscriptions.map(sub => sub.channel)}, "Subscribed channels for user"))

})

export { 
        toggleSubscription,
        getUserChannelSubscribers,
        getSubscribedChannels
    }