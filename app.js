const express = require('express');
const passport = require('passport');
const flash = require("connect-flash");
const session = require("express-session");
const helmet = require("helmet");

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

//Security headers. CSP is left off because the UI relies on a CDN script and
//inline style attributes; enabling it needs a hand-crafted policy (see DEPLOY.md).
app.use(helmet({ contentSecurityPolicy: false }));

const isProd = process.env.NODE_ENV === 'production';

//haproxy terminates TLS but the internal hop to this app is plain HTTP (and
//nginx sets X-Forwarded-Proto to its own $scheme, i.e. http). Without this the
//app sees an insecure connection, so express-session drops the Secure session
//cookie and login can never persist. We are always fronted by haproxy TLS in
//production, so normalize the forwarded proto before the session middleware.
if (isProd) {
	app.use((req, res, next) => {
		req.headers['x-forwarded-proto'] = 'https';
		next();
	});
}

//Fail closed: never run production on the well-known default session secret.
const sessionSecret = process.env.SESSION_SECRET;
if (isProd && !sessionSecret) {
	throw new Error('SESSION_SECRET must be set in production');
}

//Express Session
const sessionMiddleware = session({
	secret: sessionSecret || 'dev-only-insecure-secret',
	resave: false,
	saveUninitialized: false,
	cookie: {
		httpOnly: true,
		secure: isProd, // requires HTTPS; trust proxy lets this work behind haproxy/nginx
		sameSite: 'lax' // blocks cross-site cookie use -> mitigates CSRF and CSWSH
	}
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

//Direct home on 401 (catch-all GET; Express 5 / path-to-regexp v8 no longer
//accepts the bare '*' string, so use a regex to match any path)
app.get(/.*/, function (req, res) {
	res.redirect('/');
});

//Socket.IO
const io = require('./config/socket.io')(server, sessionMiddleware);

//MQTT -> Home Assistant (no-op unless MQTT_URL is configured)
const mqttClient = require('./config/mqtt')();

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