const axios = require('axios');

async function getTemp() {
    return axios.get('http://smokerpi.local:3081/getTemp')
    .then((response) => {
        //console.log(response.data);
        return response.data;
    })
    .catch((error) => {
        console.error(error);
    })
};
function setBlower(state) {
    axios.get('http://smokerpi.local:3081/setBlower/' + state)
    .then((response) => {
        console.log(response.data);
    })
    .catch((error) => {
        console.error(error);
    })
};

module.exports = {getTemp, setBlower}