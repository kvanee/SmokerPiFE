const db = require("../DataStore/datastore");
const validate = require("validate.js");
const sessionConstraints = require('../validation/session');
const monitor = require('../bbqMonitor');

// Browser origins allowed to open a Socket.IO connection. Without this check the
// WebSocket handshake is authorized purely by the session cookie, which lets a
// malicious page a logged-in admin visits drive the smoker on their behalf
// (Cross-Site WebSocket Hijacking). Configurable via ALLOWED_ORIGINS (comma list).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://smoker.kells.io')
    .split(',').map((o) => o.trim()).filter(Boolean);

module.exports = function (server, sessionMiddleware) {
    const io = require('socket.io')(server, {
        // Be tolerant of mobile networks that briefly stall: wait longer before
        // declaring a client gone, so the connection survives transient blips
        // instead of cycling connect/disconnect (especially on long-polling).
        pingInterval: 25000,
        pingTimeout: 60000,
        // Allow both transports; clients upgrade to websocket when the proxy
        // forwards the upgrade (see nginx/Dokku config in DEPLOY.md).
        transports: ['websocket', 'polling'],
        // Restrict cross-origin polling requests to known origins.
        cors: { origin: ALLOWED_ORIGINS, credentials: true },
        // Reject the handshake (incl. raw WebSocket, which bypasses CORS) when a
        // browser Origin is present and not whitelisted. Non-browser clients send
        // no Origin and are allowed through.
        allowRequest: (req, callback) => {
            const origin = req.headers.origin;
            const ok = !origin || ALLOWED_ORIGINS.includes(origin);
            callback(ok ? null : 'origin not allowed', ok);
        }
    });
    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    function handleMonitorEvent(data) {
        if (typeof data != 'undefined') {
            io.emit('updateTemp', data);
        }
    }

    function handleSessionNameUpdateEvent(data) {
        io.emit('setSessionName', data.sessionName);
    }
    monitor.subscribe(handleMonitorEvent);
    monitor.onSessionNameUpdate(handleSessionNameUpdateEvent);

    io.on('connection', async (socket) => {
        let user = {};
        try {
            if (socket.request.session.passport) {
                const id = socket.request.session.passport.user;
                user = await db.users.findOne({
                    email: id
                });
                console.log("User connected: " + user.email);
            }
        } catch (err) {
            //swallow exception
            console.log(err)
        }
        socket.on('setBlowerState', (data) => {
            if (user.isAdmin) {
                monitor.blowerState = data.blowerState;
                socket.broadcast.emit('setBlowerState', monitor.blowerState);
            }
        });
        socket.on('setLogState', (data) => {
            if (user.isAdmin) {
                monitor.logState = data.logState;
                socket.broadcast.emit('setLogState', data.logState);
            }
        });
        socket.on('saveSettings', (data) => {
            const {
                sessionName,
                ...partialSessionConstraints
            } = sessionConstraints;
            let validationErrors = validate(data, partialSessionConstraints, {
                format: "flat"
            })
            if (!user.isAdmin) {
                socket.emit('updateFailed', "Only an administrator can update settings.");
                socket.emit('updateSettings', {
                    period: monitor.period,
                    targetTemp: monitor.targetTemp,
                    alertHigh: monitor.alertHigh,
                    alertLow: monitor.alertLow,
                    alertMeat: monitor.alertMeat
                });
            } else if (validationErrors) {
                socket.emit('updateFailed', validationErrors[0]);
                socket.emit('updateSettings', {
                    period: monitor.period,
                    targetTemp: monitor.targetTemp,
                    alertHigh: monitor.alertHigh,
                    alertLow: monitor.alertLow,
                    alertMeat: monitor.alertMeat
                });
            } else {
                monitor.setupTimer(data.period);
                monitor.targetTemp = data.targetTemp;
                monitor.alertHigh = data.alertHigh;
                monitor.alertLow = data.alertLow;
                monitor.alertMeat = data.alertMeat;
                socket.broadcast.emit('updateSettings', data);
            }

        });
        socket.on('getSettings', function () {
            socket.emit('updateSettings', {
                period: monitor.period,
                targetTemp: monitor.targetTemp,
                alertHigh: monitor.alertHigh,
                alertLow: monitor.alertLow,
                alertMeat: monitor.alertMeat
            });
        });
        socket.on('setSessionDone', function (token) {
            socket.broadcast.emit('sessionDone');
        });
    });
    return io;
}