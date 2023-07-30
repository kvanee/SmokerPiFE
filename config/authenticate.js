isAuthenticated = function (user) {
    return typeof user != 'undefined'
}
isAdmin = function (user) {
    return isAuthenticated(user) && user.isAdmin
}
module.exports = {
    isAdmin,
    authenticate: function (req, res, next) {
        if (isAuthenticated(req.user)) {
            return next();
        }
        req.flash('error', 'Please log in');
        res.redirect('/users/login');
    },
    authenticateAdmin: function (req, res, next) {
        if (isAuthenticated(req.user) && isAdmin(req.user)) {
            return next();
        }
        req.flash('error', 'Only an administrator can perform that function.');
        res.redirect(req.originalUrl);
    }
}