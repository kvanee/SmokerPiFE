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
        },
        length: {
            minimum: 6
        }
    },
    confirmpassword: {
        equality: "password"
    }
}
module.exports = constraints;