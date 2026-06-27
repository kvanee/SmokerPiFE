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
            minimum: 8
        }
    },
    confirmpassword: {
        equality: "password"
    }
}
module.exports = constraints;