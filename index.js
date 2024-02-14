// app.js
require("dotenv").config();

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const session = require('express-session');
const nodemailer = require('nodemailer');
const flash = require('connect-flash')
const cors = require('cors');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
// const GoogleStrategy = require('passport-google-oauth20').Strategy;
const expressHandlebars = require("express-handlebars");

const create_accountM = require("./src/models/create_account.js")
const ticketM  = require("./src/models/ticket.js")
const tokenM = require("./src/models/resetToken.js")
const app = express();
const hbs = require('hbs')
app.use(
  session({
    secret: '1234567890',
    resave: false,
    saveUninitialized: true,
  })
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  create_accountM.findById(id)
  .then(user => {
    done(null, user);
  })
  .catch(err => {
    done(err, null);
  });
});
function generateResetToken() {
  return crypto.randomBytes(20).toString('hex');
}
app.use(require('express-session')({ secret: 'your-secret-key', resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

app.use(flash());
app.use(express.json());
app.set("view engine", "hbs");
app.set("views", "views");
app.set("hbs" , hbs.engine)
app.use("/static", express.static("public"));
hbs.registerPartials("views/partials");
hbs.registerHelper('sliceDate', function(dateString) {
  return dateString.slice(0, 10);
});
hbs.registerHelper('ifCond', function(v1, v2, options) {
  if(v1 == v2) {
    return options.fn(this);
  }
  return options.inverse(this);
});
// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));

const isAuthenticated = (req, res, next) => {
    if (req.session.user) {
      next();
    } else {
      res.redirect("/");
    }
}
const transporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
  },
});
// Passport setup
passport.use(new GoogleStrategy({
  // clientID: '395993618083-un4g77scvcui2q31q73sprf2pghv7c6t.apps.googleusercontent.com',
  clientID: '395993618083-42u2um79vgao52vecnrbeb1p5qlbb9j0.apps.googleusercontent.com',
  clientSecret: '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',
  // clientSecret: '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',
  callbackURL: 'https://bu-share.onrender.com/auth/google/callback',
}, async(accessToken, refreshToken, profile, done) => {
  try {
    const existingUser = await create_accountM.findOne({ email: profile.emails[0].value })
      if (existingUser) {
        return done(null, existingUser); // User already exists, log in
      }
      // Create a new user if not exists
      const newUser = new create_accountM({
        googleId: profile.id,
        name: profile.displayName,
        email: profile.emails[0].value,
      });
  
      newUser.save();
      return done(null, newUser); // User created and logged in
    // });  
  } catch (error) {
    return done(error, false);
  }
  
}));

app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: `/`}),
  (req, res) => {
    // process.nextTick(() => {
    //   const errorMessage = req.authInfo && req.authInfo.errorMessage;
    //   console.log(errorMessage);
    //   if (errorMessage) {
    //     console.log('Error message present:', errorMessage);
    //     return res.render('create_account', { errorMessage });
    //   }

    //   console.log('No error message. Redirecting to /main/' + req.user._id);
    //   res.redirect("/main/" + req.user._id);
    // });
    const userId = req.user._id;
    const email = req.user.email;
    const errorMessage = req.authInfo && req.authInfo.errorMessage;
    req.session.user = {userId:userId , email:email};
    // req.flash('success', 'Successfully authenticated with Google.');
    // const userEmail = req.user.email;
    // const userExists = await create_accountM.findOne({ email: userEmail });
    // if (userExists) {
    //   return res.render('create_account.hbs', { errorMessage: 'This email already exists.' });
    // }
    if (errorMessage) {
      return res.render('create_account', { errorMessage:errorMessage});
    }
    res.redirect("/main/"+userId);
  }
);
app.get('/logout' , (req,res)=>{
  req.session.destroy(err=>{
    if(err){
      console.error(err)
    }
    res.redirect('/')
  })
})
app.get('/' , (req,res)=>{
    res.render('create_account.hbs');
})
app.get('/forgotpass' , (req , res)=>{
  res.render('forgotPass')
})
app.post('/forgotpass' , async(req, res)=>{
  const userEmail = req.body.email;
  const resetToken = generateResetToken();
  await tokenM({resetToken , userEmail}).save();
  await sendEmail(userEmail, `Password Reset`, `Dear user,
You have requested to reset your password. To proceed, please click on the following link:

${process.env.PASS_RESET_LINK}${resetToken}

Please note that this link is valid for 5 minutes. After this period, you will need to initiate the password reset process again.

If you did not request this password reset, please ignore this email.

Best regards,
BU-Shares`);
  setTimeout(() => {
    res.redirect('/forgotpass');
  }, 3000); // 5000 milliseconds (5 seconds)
  // res.redirect('/forgotpass')
})
app.get('/reset-password/:token' , async(req,res)=>{
  const token = req.query.token;
  const validateuser = await tokenM.findOne({token:token});
  const userEmail = validateuser.userEmail;
  if(validateuser){
    res.render('resetPass', {userEmail:userEmail})
  }
  else{
    res.redirect('/')
  }
})
app.post('/change-pass/:id' ,isAuthenticated, async(req,res)=>{
  const id = req.params.id;
  const updatedPass = req.body.password;
  await create_accountM.findByIdAndUpdate(
    id,
    { $set: { password: updatedPass } },
    { new: true }
  )
  res.redirect('/main/'+id);
})
// Add a route for the "Create with Google" button
app.get('/create-with-google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/details/:id',isAuthenticated, async(req,res)=>{
  const id = req.params.id;
  const senddata = await create_accountM.findOne({_id:id});
  res.render("yours_details",{senddata:senddata});
})
app.post('/Update-pass/:email' ,isAuthenticated, async(req,res)=>{
  const email = req.params.email;
  const pass = req.body.password;
  console.log(email , pass);
  try {
    const findcoll = await create_accountM.findOne({ email: email });

    if (findcoll) {
      const updateProfile = await create_accountM.findOneAndUpdate(
        { email: email },
        { $set: { password: pass } },
        { new: true }
      );

      console.log('Password updated successfully!');
      res.redirect('/login')
    } else {
      console.log('No user found with the provided email.');
      res.redirect('/');
    }
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).send('Internal Server Error');
  }
})
app.post("/submit-form", async (req, res) => {
    try {
      const create_accountdata = new create_accountM(req.body);
      const email = req.body.email;
      const existingacc = await create_accountM.findOne({email:email});
      if(existingacc){
        res.redirect(`/?message=${encodeURIComponent('1')}`);
      }
      else{
        await create_accountdata.save();
        const data = await create_accountM.findOne({email:email}); 
        const id = data._id ;
        req.session.user = {userId:id , email:email};
        res.redirect("/main/"+id);
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Internal Server Error");
    }
});
app.post('/ticketform/:id',isAuthenticated, async(req,res)=>{
    try {
        const id = req.params.id;
        const user = await create_accountM.findOne({ _id: id });
        if (!user) {
          return res.status(404).redirect('/');
        }
        const generaterEmail = user.email;
        const firstname = user.name;
        const {
          category,
          phone,
          date,
          vacantSeats,
          time,
          startingPoint,
          destination,
          EnrollmentNo,
          meetingPoint,
          luggage
        } = req.body;
        const ticketdata = new ticketM({
          firstname,
          generaterEmail,
          category,
          phone,
          date,
          vacantSeats,
          time,
          startingPoint,
          destination,
          EnrollmentNo,
          meetingPoint,
          luggage
      });
        const saveticket = await ticketdata.save();
        console.log(saveticket);
        await sendEmail(generaterEmail, `Ticket Created form ${req.body.startingPoint} to ${req.body.destination}`, `**Ticket Confirmation**

        Dear ${user.name},
        
        We are pleased to inform you that your ticket has been created successfully for the following journey:
        
        - **From:** ${req.body.startingPoint}
        - **To:** ${req.body.destination}
        - **Date:** ${req.body.date}
        - **Time:** ${req.body.time}
        - **Enrollment Number:** ${req.body.EnrollmentNo}
        - **Vacant Seats:** ${req.body.vacantSeats}
        - **Meeting Point:** ${req.body.meetingPoint}
        
        Thank you for choosing our services. Should you have any inquiries or require assistance, please feel free to contact us.
        
        Best Regards,
        BU-Share
        `);
        user.myticketID.push(saveticket._id);
        await user.save();
        return res.redirect('/main/'+id);
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
})
app.get("/main/:id", async (req, resp) => {
    const id = req.params.id;
    const senddata = await create_accountM.findOne({_id:id});
    resp.render("main2",{senddata:senddata});
});
app.get("/ticket/:id",isAuthenticated,async(req,resp)=>{
    const id = req.params.id;
    // console.log(id);
    const senddata = await create_accountM.findOne({_id:id})
    // console.log(senddata._id);
    resp.render("gen_tic2",{senddata:senddata});
})
app.get("/find/:id",isAuthenticated,async(req,resp)=>{
    const id  = req.params.id;
    const senddata = await create_accountM.findOne({_id:id})
    const allrides = await ticketM.find({});
    resp.render("findrides",{allrides:allrides ,senddata:senddata});
})
app.get("/yourtickets/:id" ,isAuthenticated, async(req,resp)=>{
  const id  = req.params.id;
  const senddata = await create_accountM.findOne({_id:id});
  const currentDate = new Date().toISOString().split('T')[0];
  // const userData = await create_accountM.findById(id).populate("myticketID")
  const userData = await create_accountM.findById(id).populate({
    path: "myticketID",
    match: { date: { $gte: currentDate } } // Add your date constraint here
  })
  const exptickets = await create_accountM.findById(id).populate({
    path: "myticketID",
    match: { date: { $lt: currentDate } } // Add your date constraint here
  })
  var Heading2 = "";
  if(exptickets.myticketID.length > 0){
    Heading2 = "History";
  }
  console.log(Heading2)
  resp.render("your_tickets",{senddata:senddata , userData:userData , exptickets:exptickets , Heading2:Heading2});
})
app.post('/yourtickets/:id' ,isAuthenticated, async(req,res)=>{
  const { delticketid } = req.body;
  const passengerId = req.params.id;
  const TicketToBeDeleted = await ticketM.findOne({_id:delticketid});
  const mypassengersArray = TicketToBeDeleted.mypassengers;
  mypassengersArray.forEach(async(element) =>{
    const passname = element.name;
    const passemail = element.passemail;
    await sendEmail(passemail, `Ticket Dleted from ${TicketToBeDeleted.startingPoint} to ${TicketToBeDeleted.destination}`, 
    `
    Dear ${passname},

    We regret to inform you that the ticket for the journey from ${TicketToBeDeleted.startingPoint} to ${TicketToBeDeleted.destination} has been deleted by the sharer. Below are the details of the deleted ticket:
    
    - **Journey Details:**
      - **From:** ${TicketToBeDeleted.startingPoint}
      - **To:** ${TicketToBeDeleted.destination}
    
    - **Travel Information:**
      - **Date:** ${TicketToBeDeleted.date}
      - **Time:** ${TicketToBeDeleted.time}
    
    - **Contact Information:**
      - **Sharer's Phone Number:** ${TicketToBeDeleted.phone}
      - **Enrollment Number:** ${TicketToBeDeleted.EnrollmentNo}
    
    We understand that plans may change, and we apologize for any inconvenience caused. If you have any further questions or need assistance, please feel free to reach out to us.
    
    Thank you for your understanding.
    
    Best regards,
    BU-Share`);
      // const passenger = await create_accountM.findOne({_id:passid});
      const removepass = await create_accountM.findByIdAndUpdate(
        element.passid,
        {
          $pull: { joinedTkts: delticketid } 
        },
        { new: true }
      )
  });
  const genfname = TicketToBeDeleted.firstname;
  // const genlname = TicketToBeDeleted.lastname;
  const generaterEmail = TicketToBeDeleted.generaterEmail;
  await sendEmail(generaterEmail, `Your Ticket Dleted from ${TicketToBeDeleted.startingPoint} to ${TicketToBeDeleted.destination}`, 
  `Dear ${genfname},

  We would like to inform you that the ticket for the journey from ${TicketToBeDeleted.startingPoint} to ${TicketToBeDeleted.destination} has been successfully deleted. Below are the details of the deleted ticket:
  
  - **Journey Details:**
    - **From:** ${TicketToBeDeleted.startingPoint}
    - **To:** ${TicketToBeDeleted.destination}
  
  - **Travel Information:**
    - **Date:** ${TicketToBeDeleted.date}
    - **Time:** ${TicketToBeDeleted.time}
  
  - **Contact Information:**
    - **Sharer's Phone Number:** ${TicketToBeDeleted.phone}
    - **Enrollment Number:** ${TicketToBeDeleted.EnrollmentNo}
  
  If you have any questions or concerns regarding this ticket deletion, please feel free to reach out to us. We appreciate your understanding and cooperation.
  
  Thank you for using our services.
  
  Best regards,
  BU-Share
  `);
  const removeticket  = await ticketM.findByIdAndDelete({_id:delticketid});
  const removefromgenerater = await create_accountM.findByIdAndUpdate(
      passengerId,
      {
        $pull: { myticketID: delticketid } 
      },
      { new: true }
  )
})
app.post("/findform/:id" ,isAuthenticated, async(req,res)=>{
  const finderid = req.params.id;
  const time = req.body.time;
  const date = req.body.date;
  const starting = req.body.starting;
  const destination = req.body.destination;
  const message = "People Going your Way :"
  const senddata = await create_accountM.findOne({_id:finderid});
  const matchedtickets = await ticketM.find({date:date, 
    startingPoint:{ $regex: new RegExp(starting, 'i')}  , 
    destination: { $regex: new RegExp(destination, 'i') }
  });
  const matchedticketswithoutdates = await ticketM.find({ 
    startingPoint:{ $regex: new RegExp(starting, 'i')}  , 
    destination: { $regex: new RegExp(destination, 'i') },
    date: { $ne: date }
  });
  var secondmessage = ""
  if(matchedticketswithoutdates.length >0){
    secondmessage = "On Other Dates :"
  }
  res.render('avalrides' , {tickets:matchedtickets , id:finderid , message:message, senddata:senddata , matchedticketswithoutdates:matchedticketswithoutdates ,secondmessage:secondmessage});

})
app.get("/login" , (req,res)=>{
    res.render("login-page")     
});
app.post('/loginform' , async(req,res)=>{
    try {
        const email = req.body.email;
        const pass = req.body.password;
        const create_accountdata = await create_accountM.findOne({email:email , password:pass});
        if(create_accountdata){
            const id = create_accountdata._id;
            req.session.user = {userId:id , email:email};
            res.redirect('/main/'+id);
        }
        else{
          res.redirect(`/login/?islogin=${encodeURIComponent('0')}`);
        }
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server error')
    }
})
app.get('/joined/:id' ,isAuthenticated, async(req,res)=>{
  const id  = req.params.id;
  const senddata = await create_accountM.findOne({_id:id});
  const currentDate = new Date().toISOString().split('T')[0];
// const joinedTicketData = await create_accountM.findById(id).populate("joinedTkts")
  const joinedTicketData = await create_accountM.findById(id).populate({
    path: "joinedTkts",
    match: { date: { $gte: currentDate } } // Add your date constraint here
  })
  const exptickets = await create_accountM.findById(id).populate({
    path: "joinedTkts",
    match: { date: { $lt: currentDate } } // Add your date constraint here
  })
  var Heading2 = "";
  if(exptickets.joinedTkts.length > 0){
    Heading2 = "Previosly Joined";
  }
  // console.log(Heading2)
  // resp.render("your_tickets",{senddata:senddata , userData:userData , exptickets:exptickets , Heading2:Heading2});
  res.render("joined",{senddata:senddata , joinedTicketData:joinedTicketData , exptickets:exptickets , Heading2:Heading2});
})
app.post('/joined/:id' ,isAuthenticated, async(req, res)=>{
  console.log("on server side ")
  const { ticketid } = req.body;
  const passengerId = req.params.id;
  try{
    const upadteprofile = await create_accountM.findByIdAndUpdate(
      passengerId,
      {
        $pull: { joinedTkts: ticketid } 
      },
      { new: true }
    )
    const updatedTicket = await ticketM.findByIdAndUpdate(
      ticketid,
      {
        $inc: { vacantSeats: +1 },
        $pull: { 
          mypassengers: {
            passid:passengerId,
          },
        } 
      },
      { new: true } // Return the updated document
    );
      
    return window.location.href="/main/"+passengerId;
  }
  catch{
    
  }
})
app.get('/avalrides/:id' ,isAuthenticated, async(req,res)=>{
  const id = req.params.id;
  const senddata = await create_accountM.findOne({_id:id});
  const currentDate = new Date().toISOString().split('T')[0];
  const alltickets = await ticketM.find({ date: { $gte: currentDate } });
  // const companiondata = await ticketM.find().populate("mypassengers");
  // // console.log(companiondata);
  // companiondata.forEach((ticket) => {
  //   console.log(ticket.mypassengers);
  // });
  const message="All the Current Available Rides are"
  res.render('avalrides' , {tickets:alltickets , message:message , senddata:senddata });
})
app.post('/avalrides/:id',isAuthenticated, async (req, res) => {
  console.log("on server side in available section ")
  // console.log(req.body);
  const { ticketid } = req.body;
  const passengerId = req.params.id;
  const passdetails = await create_accountM.findOne({_id:passengerId});
  const tkt = await ticketM.findById({_id:ticketid});
  const generaterEmail = tkt.generaterEmail;
  const passemail = passdetails.email;
  var generaterOfThisTkt = false;
   
  const redundantTicket = await ticketM.findOne(
    {
      '_id':ticketid,
      'mypassengers.passid': passengerId
    }
  );
  try {
    if(generaterEmail === passemail){
      console.log("in 1st if")
      generaterOfThisTkt = true;
      res.redirect(`/yourtickets/${passengerId}`)
    }
    else if(!redundantTicket){
      console.log('in 2nd if')
      const upadteprofile = await create_accountM.findByIdAndUpdate(
        passengerId,
        {
          $push: { joinedTkts: ticketid } 
        },
        { new: true }
      )
      const updatedTicket = await ticketM.findByIdAndUpdate(
          ticketid,
          {
            $inc: { vacantSeats: -1 },
            $push: { 
              mypassengers: {
                passid:passengerId,
                passname:passdetails.name,
                passemail:passdetails.email,
              },
            } 
          },
          { new: true } // Return the updated document
      );
      const passengerName = passdetails.name;
      const passengerEmail = passdetails.email;
      const passengerPhone = passdetails.phone;
      const generaterdetails = await ticketM.findOne({_id:ticketid});
      const generaterEmail = generaterdetails.generaterEmail;
      const generaterfName = generaterdetails.firstname;
      // const generaterlName = generaterdetails.lastname;
      await sendEmail(generaterEmail, `Someone joined You`, `**Companion Confirmation**

      Dear ${generaterfName},
      
      We are delighted to inform you that a new companion has joined your journey. Below are the details:
      
      - **Name:** ${passengerName}
      - **Email:** ${passengerEmail}
      - **Contact:** ${passengerPhone}
      
      We appreciate your companionship and wish you a pleasant journey together. If you have any questions or need further assistance, feel free to reach out.
      
      Safe travels!
      
      Best Regards,
      BU-Share
      `);  
      await sendEmail(passengerEmail, `Successfully joined ${generaterfName}'s Ticket`,
      `
      Dear ${passengerName},
      
      We are pleased to inform you that you have successfully joined the journey of ${generaterfName}. Below are the details of your shared ticket:
      
      - **Journey Details:**
        - **From:** ${generaterdetails.startingPoint}
        - **To:** ${generaterdetails.destination}
      
      - **Travel Information:**
        - **Date:** ${generaterdetails.date}
        - **Time:** ${generaterdetails.time}
      
      - **Contact Information:**
        - **Sharer's Phone Number:** ${generaterdetails.phone}
        - **Enrollment Number:** ${generaterdetails.EnrollmentNo}
      
      - **Available Seats:**
        - Total Seats: ${generaterdetails.vacantSeats + 1} (including yours)
      
      - **Meeting Point:**
        - ${generaterdetails.meetingPoint}
      
      Please make sure to arrive on time and enjoy a pleasant journey with your fellow travelers. If you have any questions or need further assistance, feel free to contact us.
      
      Safe travels!
      
      Best regards,
      BU-Share`);
    }
    else{
      console.log('in else')
      res.redirect(`/avalrides/${passengerId}/?haveTicket=${encodeURIComponent('1')}`);
      
    }
    // res.json({ success: true, updatedTicket },{ success: true, upadteprofile });
    // res.json();
    // return res.redirect('/joined/'+passengerId);
  }catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});
// Routes
async function sendEmail(to, subject, text) {
  const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
  };

  await transporter.sendMail(mailOptions);
}
const authRoutes = require('./src/routes/auth.js');
const { log, Console } = require("console");
app.use('/auth', authRoutes);

// Start the server
const PORT = process.env.PORT || 3000;
app.use(cors());
app.listen(PORT,'0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
