const mongoose = require("mongoose")
const token = mongoose.Schema({
    resetToken:{
        type:String,
        required:true,
    },
    userEmail:{
        type:String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 300, // Set expiration time to 5 minutes (300 seconds)
    },
})
module.exports = mongoose.model("validTokens" , token)