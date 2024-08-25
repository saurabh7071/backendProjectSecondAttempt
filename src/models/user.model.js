import mongoose, {Schema} from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true,
        index: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        unique: true,
    },
    fullname: {
        type: String,
        required: true,
        trim: true,
        index: true,
    },
    avatar : {
        type: String,   // Cloudinary url
        required: true,
    },
    coverImage: {
        type: String,   // Cloudinary url
    },
    password: {
        type: String,
        required: [true, 'Password is Required!!']
    }
},{timestamps: true})

// bcrypt - password encryption 
userSchema.pre("save", async function(next){
    if(!this.isModified("password")) return next();

    this.password = await bcrypt.hash(this.password, 10)
    next()
})

userSchema.methods.comparePassword = async function(password){
    return await bcrypt.compare(password, this.password);
}

// Access Tokes 

// Refresh Toknes 

export const User = mongoose.model("User", userSchema)