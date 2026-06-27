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
            try {
                //Match User
                const user = await db.users.findOne({
                    email: email
                })
                if (!user) {
                    return done(null, false, {
                        message: "Account not registered"
                    });
                }
                //Match Password
                const isMatch = await bcrypt.compare(password, user.password);
                if (isMatch) {
                    return done(null, user);
                }
                return done(null, false, {
                    message: 'Incorrect Password'
                });
            } catch (err) {
                return done(err);
            }
        })
    );
    passport.serializeUser((user, done) => {
        done(null, user.email);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await db.users.findOne({
                email: id
            });
            done(null, user);
        } catch (err) {
            done(err);
        }
    });
}