const mongoose = require("mongoose")
// const expticketM = require("../models/expTickets.js")
const ticket = mongoose.Schema({
    firstname:String,
    lastname:{
        type:String,
        default:null,
    },
    generaterEmail:String,
    category:String,
    phone:Number,
    date:String,
    vacantSeats:Number,
    time:String,
    startingPoint:String,
    destination:String,
    EnrollmentNo:String,
    meetingPoint:String,
    luggage:String,
    mypassengers:[
        {
            passid:{ 
                type : mongoose.ObjectId,
                ref : 'info',
            },
            passname: {
                type: String,
                //required: true,
            },
            passemail:{
                type:String,
            }
        },
    ],
    // expirationDate: {
    //     type: Date,
    //     expires: 0, // Will be set dynamically during document creation
    // },
})

// ticket.pre('save', function (next) {
//     const inputDate = new Date(this.date);
//     this.expirationDate = new Date(inputDate.getTime() + 24 * 60 * 60 * 1000);
//     next();
// });

// const changeStream = ticket.watch([{ $match: { operationType: 'invalidate' } }]);
// changeStream.on('change', async (change) => {
//     try {
//         const expiredDocument = await ticket.findById(change.documentKey._id);
//         if (expiredDocument) {
//             // Move the expired document to another collection (assuming there's a model named 'ExpiredTicket' for the new collection)
//             // const ExpiredTicket = mongoose.model('expiredticketdata');
//             await expticketM.create(expiredDocument.toObject());
//             // Remove the expired document from the original collection
//             await ticket.findByIdAndDelete(expiredDocument._id);
//             console.log('Document moved successfully.');
//         }
//     } catch (err) {
//         console.error('Error moving document:', err);
//     }
// });
// const currdate = new Date();
// if((expirationDate == currdate) || (expirationDate>currdate)){
    
// }
const Ticket = mongoose.model("ticketdata" , ticket)
// ticket.pre("save", async function (next) {
//     // Check if date and time conditions are met
//     const currentDate = new Date();
//     const inputDate = new Date(`${this.date} ${this.time}`);
//     console.log("Current Date:", currentDate);
//     console.log("Input Date:", inputDate);
//     if (inputDate > currentDate) {
//       try {
//         // Save the current document to another collection
//         const ExpTicket = mongoose.model("expTicketdata", ticket);
//         const expTicket = new ExpTicket(this.toObject());
//         await expTicket.save();
  
//         next(); // Continue with the original save
//       } catch (error) {
//         next(error);
//       }
//     } else {
//       next(); // Continue with the original save
//     }
//   });
module.exports = Ticket;