const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    //already logged in
    if (typeof req.user != 'undefined')
        res.redirect("/session/dashboard");
    res.render("welcome")
});

module.exports = router;