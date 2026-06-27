// Login only checks that both fields are present. Password strength is enforced
// at registration; applying registration rules here would lock out existing
// users whose passwords predate a policy change.
const constraints = {
    email: {
        presence: {
            allowEmpty: false
        },
        email: true
    },
    password: {
        presence: {
            allowEmpty: false
        }
    }
}
module.exports = constraints;
