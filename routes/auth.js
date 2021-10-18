var express = require('express');
var passport = require('passport');

var router = express.Router();

/* GET users listing. */
router.get('/login', function(req, res, next) {
  var errorMessages = req.flash();
  res.render('login', {errorMessage: errorMessages.length > 0 ? errorMessages[0]: null});
});

router.post('/login/password', passport.authenticate('local', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureMessage: true,
  failureFlash: 'Invalid username or password.'
}));

router.get('/logout', function(req, res, next) {
  req.logout();
  res.redirect('/');
});

module.exports = router;