$(document).ready(function () {
    const socket = io('https://smoker.kells.io');

    socket.on('connect', () => {
        window.location = 'https://smoker.kells.io'
    });
});