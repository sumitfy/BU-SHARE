// routes/auth.js

const express = require('express');
const router = express.Router();
const create_accountM = require('../models/create_account');

// Register user
router.post('/submit-form', async (req, res) => {
  // Handle registration logic, save user data to the database
  try {
    const create_accountdata = new create_accountM(req.body);
    console.log(req.body.name);
    await create_accountdata.save();

    res.redirect("/main");
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
router.get('/' , (req,res)=>{
    res.render('create_account.hbs');
})
// Login user
router.post('/loginform', async (req, res) => {
  const { email, password } = req.body;

  // Check if the user exists in the database
  const user = await create_accountM.findOne({ email, password });

  if (user) {
    // Store user information in the session
    req.session.user = user;
    res.redirect('/main'); // Redirect to the main page
  } else {
    res.redirect('/'); // Redirect to the create account page
  }
});

module.exports = router;
