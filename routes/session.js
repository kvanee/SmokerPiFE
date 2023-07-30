const express = require('express');
const router = express.Router();
const validate = require("validate.js");
const sessionConstraints = require('../validation/session');
const {
    authenticateAdmin
} = require('../config/authenticate');
const monitor = require('../bbqMonitor');

router.get('/new', (req, res) => {
    res.render("session/new-session", {
        sessionName: monitor.sessionName,
        period: monitor.period,
        targetTemp: monitor.targetTemp,
        alertHigh: monitor.alertHigh,
        alertLow: monitor.alertLow,
        alertMeat: monitor.alertMeat
    });
});

router.post('/new', authenticateAdmin, (req, res, next) => {
    const session = {
        sessionName,
        period,
        targetTemp,
        alertHigh,
        alertLow,
        alertMeat
    } = req.body;

    //Check required fields
    let validationErrors = validate(session, sessionConstraints)
    if (validationErrors) {
        res.render("session/new-session", {
            validationErrors,
            sessionName: session.sessionName,
            period: session.period,
            targetTemp: session.targetTemp,
            alertHigh: session.alertHigh,
            alertLow: session.alertLow,
            alertMeat: session.alertMeat
        });
    } else {
        monitor.isSessionStarted = true;
        monitor.setSessionName(sessionName);
        monitor.setupTimer(period);
        monitor.targetTemp = targetTemp;
        monitor.alertHigh = alertHigh;
        monitor.alertLow = alertLow;
        monitor.alertMeat = alertMeat;
        res.redirect("/session/dashboard/" + monitor.sessionName);
    }
});

router.get('/complete', (req, res, next) => {
    monitor.blowerState = "off";
    monitor.logState = "off";
    monitor.isSessionComplete = true;
    res.render("session/complete", {
        sessionName: monitor.sessionName,
        isAdmin: req.user.isAdmin
    });
});

router.get('/dashboard', (req, res) => {
    if (monitor.isSessionComplete)
        res.redirect("/session/complete");
    else if (typeof req.user != 'undefined' && req.user.isAdmin && !monitor.isSessionStarted)
        res.redirect("/session/new");
    else
        res.redirect("/session/dashboard/" + monitor.sessionName)
});

router.get('/dashboard/:sessionName', (req, res) => {
    const sessionName = req.params.sessionName;
    if (typeof req.user != 'undefined' && req.user.isAdmin && sessionName !== monitor.sessionName)
        if (validate(sessionName, sessionConstraints))
            monitor.setSessionName(sessionName);

    res.render("session/dashboard", {
        currBbqTemp: monitor.currBbqTemp.toFixed(1),
        currMeatTemp: monitor.currMeatTemp.toFixed(1),
        targetTemp: monitor.targetTemp,
        isBlowerOn: monitor.isBlowerOn,
        blowerState: monitor.blowerState,
        logState: monitor.logState,
        sessionName: monitor.sessionName,
        period: monitor.period,
        alertHigh: monitor.alertHigh,
        alertLow: monitor.alertLow,
        alertMeat: monitor.alertMeat,
        isAdmin: req.user.isAdmin
    });
});

router.post('/dashboard', authenticateAdmin, (req, res) => {
    monitor.isSessionStarted = false;
    res.redirect('/session/complete');
});

router.get('/loadChartData/:sessionName', (req, res) => {
    monitor.getTemperatureLog(req.params.sessionName)
        .then((data) => {
            res.json(data);
        }).catch((err) => {
            console.log(err);
        });
});

module.exports = router;