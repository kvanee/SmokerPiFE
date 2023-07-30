//https://github.com/bradtraversy/node_passport_login
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');

//DB
const db = require("../DataStore/datastore");

module.exports = function (passport) {
    passport.use(
        new LocalStrategy({
            usernameField: 'email'
        }, async (email, password, done) => {
            //Match User
            user = await db.users.findOne({
                email: email
            })
            if (!user) {
                return done(null, false, {
                    message: "Account not registered"
                });
            }
            //Match Password
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) throw err;
                if (isMatch) {
                    return done(null, user);
                } else {
                    return done(null, false, {
                        message: 'Incorrect Password'
                    });
                }
            });
        })
    );
    passport.serializeUser((user, done) => {
        done(null, user.email);
    });

    passport.deserializeUser(async (id, done) => {
        user = await db.users.findOne({
            email: id
        });
        done(null, user);
    });
}