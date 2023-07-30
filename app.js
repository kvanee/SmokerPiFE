const express = require('express');
const passport = require('passport');
const flash = require("connect-flash");
const session = require("express-session");

const app = express();
const {
	authenticate: authenticate
} = require('./config/authenticate')


//Passport config
require('./config/passport')(passport);

//Create unsecure server
const server = require('http').createServer(app);

const favicon = require('serve-favicon');

//Use Pug
app.set('view engine', 'pug');

//Bodyparser
app.use(express.urlencoded({
	extended: false
}))

//Express Session
const sessionMiddleware = session({
	secret: 'deodorant',
	resave: true,
	saveUninitialized: true
});
app.use(
	sessionMiddleware
);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

//Connect flash
app.use(flash());

//globals
app.use((req, res, next) => {
	res.locals.success = req.flash('success');
	res.locals.errors = req.flash('error');
	next();
})

//Add favicon
app.use(favicon(__dirname + '/public/images/favicon.png'));

//Add static routes
app.use(express.static('public'));

//Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/session', authenticate, require('./routes/session'));

//Direct home on 401
app.get('*', function (req, res) {
	res.redirect('/');
});

//FCM
//const fcm = new fcmLib("https://smoker.kells.io/images/favicon.png");

//Socket.IO
require('./config/socket.io')(server, sessionMiddleware);


app.get('/health-check', function (req, res) {
	res.sendStatus(200)
});

const port = 3080;
server.listen(port, function () {
	console.log('listening on port ' + port);
});