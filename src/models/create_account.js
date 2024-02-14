const mongoose = require("mongoose")
const userdata = mongoose.Schema({
    name:{
        type:String,
        requried:true,
    },
    email:{
        type: String,
        unique: true,
    },
    phone:{
        type:String,
    },
    password:{
        type:String,
        default:null,
    },
    myticketID:[
        {
            type : mongoose.ObjectId ,
            ref : 'ticketdata'
        }, 
    ],
    joinedTkts:[
        {
            type : mongoose.ObjectId,
            ref : 'ticketdata'
        }
    ],
    googleId: {
        type: String,
        unique: true,
        sparse:true,
    },
})

module.exports = mongoose.model("info" , userdata)