// routes/main.js

const express = require('express');
const router = express.Router();

// Middleware to check if the user is logged in
const requireLogin = (req, res, next) => {
  if (req.session.user) {
    next(); // User is logged in, proceed to the main page
  } else {
    res.redirect('/'); // Redirect to the create account page if not logged in
  }
};

// Main page route
router.get('/main', requireLogin, (req, res) => {
  // Render the main page
  res.render('main2');
});

module.exports = router;
