const express = require('express');
const router = express.Router();
const passport = require('passport');
const bcrypt = require('bcryptjs');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const validate = require("validate.js");
const registrationConstraints = require('../validation/registration')
const loginConstraints = require('../validation/login')
const db = require("../DataStore/datastore");

// Throttle login/registration to blunt online password guessing. Keyed by the
// submitted email rather than IP: behind haproxy every request arrives from the
// proxy's address, so a per-IP limit would be one shared bucket that locks out
// all users at once. Per-email keying caps guessing against each account and
// avoids that. Skipped under test so the suite's repeated logins don't trip it.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    // Passport returns 302 for both success and failure, so the limiter can't
    // skip successful logins by status; keep the cap high enough that a user
    // fumbling their password isn't locked out, while still bounding guessing.
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.body && req.body.email)
        ? String(req.body.email).toLowerCase()
        : ipKeyGenerator(req.ip),
    skip: () => process.env.NODE_ENV === 'test',
    message: 'Too many attempts. Please try again later.'
});


//Login
router.get('/login', (req, res) => res.render("login"));

//Register
router.get('/register', (req, res) => res.render("register"));

//Logout
router.get('/logout', (req, res, next) => {
    req.logout(function (err) {
        if (err) {
            return next(err);
        }
        req.flash('success', 'You have been logged out.')
        res.redirect('/users/login');
    });
});

//Login Handle
router.post('/login', authLimiter, (req, res, next) => {
    let user = {
        email,
        password
    } = req.body;
    //Check required fields
    let validationErrors = validate(user, loginConstraints)
    if (validationErrors)
        res.render('login', {
            validationErrors,
            email,
            password
        });
    else
        passport.authenticate('local', {
            successRedirect: "/session/dashboard",
            failureRedirect: "/users/login",
            failureFlash: true
        })(req, res, next);
});

//Register Handle
router.post('/register', authLimiter, async (req, res) => {
    let user = {
        email,
        password,
        confirmpassword
    } = req.body;
    //Check required fields
    let validationErrors = validate(user, registrationConstraints)

    //Check for existing user
    let existingUser = await db.users.findOne({
        email: email
    });
    if (existingUser) {
        validationErrors = validationErrors || {};
        (validationErrors.email = validationErrors.email || []).push(
            'Account already registered'
        );
    }
    if (validationErrors) {
        res.render("register", {
            validationErrors,
            email,
            password,
            confirmpassword
        });
    } else {
        // Hash Password
        bcrypt.hash(password, 10).then(function (hash) {
            let newUser = {
                email,
                password: hash,
                isAdmin: false
            }
            db.users.insert(newUser);
            req.flash('success', 'You are now registered! Log in to continue.')
            res.redirect("login");
        });
    }
});

module.exports = router;