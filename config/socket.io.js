const db = require("../DataStore/datastore");
const validate = require("validate.js");
const sessionConstraints = require('../validation/session');
const monitor = require('../bbqMonitor');
let inAlert = false;

module.exports = function (server, sessionMiddleware) {
    const io = require('socket.io')(server);
    io.use((socket, next) => {
        sessionMiddleware(socket.request, {}, next);
    });

    function handleMonitorEvent(data) {
        if (typeof data != 'undefined') {
            io.emit('updateTemp', data);
            if (data.currMeatTemp >= monitor.alertMeat) {
                if (!inAlert) {
                    inAlert = true;
                }
            } else if (data.currBbqTemp > monitor.alertHigh || data.currBbqTemp < monitor.alertLow) {
                if (!inAlert) {
                    inAlert = true;
                }
            } else if (inAlert) {
                inAlert = false;
            }
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
                id = socket.request.session.passport.user;
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
        socket.on('setFcmToken', function (token) {
            // fcm.addFCMListener(token);
        });
    });
    return {}
}