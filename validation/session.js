const constraints = {
    sessionName: {
        presence: true,
        format: {
            pattern: "[0-9]{4}-[0-9]{2}-[0-9]{2}-[A-z]+-?[A-z]?",
            message: "must be in the format yyyy-mm-dd-meat"
        }
    },
    period: {
        presence: {
            allowEmpty: false
        },
        numericality: {
            lessThan: 60,
            greaterThanOrEqualTo: 1
        }
    },
    targetTemp: {
        presence: {
            allowEmpty: false
        },
        numericality: {
            lessThan: 400,
            greaterThan: 0
        }
    },
    alertHigh: {
        presence: {
            allowEmpty: false
        },
        numericality: {
            lessThan: 450,
            greaterThan: 0
        }
    },
    alertLow: {
        presence: {
            allowEmpty: false
        },
        numericality: {
            lessThan: "alertHigh",
            greaterThan: 0
        }
    },
    alertMeat: {
        presence: {
            allowEmpty: false
        },
        numericality: {
            lessThan: 250,
            greaterThan: 0
        }
    }
}
module.exports = constraints;