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

//Trust the reverse proxy (Dokku/nginx) so secure cookies and protocol work correctly
app.set('trust proxy', 1);

//Express Session
const sessionMiddleware = session({
	secret: process.env.SESSION_SECRET || 'deodorant',
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

//Health check (used by Dokku CHECKS) - must be before the catch-all redirect
app.get('/health-check', function (req, res) {
	res.sendStatus(200)
});

//Routes
app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/session', authenticate, require('./routes/session'));

//Direct home on 401
app.get('*', function (req, res) {
	res.redirect('/');
});

//Socket.IO
const io = require('./config/socket.io')(server, sessionMiddleware);

//Only start listening when run directly (`node app.js`), not when imported
//by the test suite, which manages the server lifecycle itself.
if (require.main === module) {
	const port = process.env.PORT || 3080;
	server.listen(port, function () {
		console.log('listening on port ' + port);
	});
}

module.exports = {
	app,
	server,
	io,
	sessionMiddleware
};