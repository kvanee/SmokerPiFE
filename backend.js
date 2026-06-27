const axios = require('axios');

// Base URL of the hardware backend (Raspberry Pi temperature/blower controller).
// Override with the BACKEND_URL environment variable when deploying.
const BACKEND_URL = process.env.BACKEND_URL || 'http://smokerpi.local:3081';

async function getTemp() {
    return axios.get(BACKEND_URL + '/getTemp')
    .then((response) => {
        //console.log(response.data);
        return response.data;
    })
    .catch((error) => {
        console.error(error);
    })
};
function setBlower(state) {
    axios.get(BACKEND_URL + '/setBlower/' + state)
    .then((response) => {
        console.log(response.data);
    })
    .catch((error) => {
        console.error(error);
    })
};

module.exports = {getTemp, setBlower}