const wifi = require('../wifi-setup/wifi-mgr')()
module.exports = function (app, server) {
    const io = require('socket.io')(server);
    let wifiConnected = true;

    async function ensureWifi() {
        wifiConnected = await wifi.isConnected();
        if (!wifiConnected) {
            console.log('No wifi, staring AP...');
            wifi.startAP();
        }
    }
    //ensureWifi();
    //setInterval(ensureWifi, 60000);

    app.use('/', (req, res, next) => {
        //Setup Wifi on First use.
        if (!wifiConnected) {
            console.log('wifi down, starting setup.')
            if (req.method == 'GET') {
                wifi.findNetworks(5).then((ssids) => {
                    res.render("wifi-setup", {
                        ssids
                    });
                }).catch(() => {
                    res.render("wifi-setup", {
                        ssids: ['no networks found, reload the page to search again.']
                    });
                });
            }
            if (req.method == 'POST') {
                const network = {
                    ssid,
                    password
                } = req.body;
                //direct to page to wait for wifi connection
                res.render("connecting");
                //Connect after 500ms delay to allow page to render. 
                setTimeout(() => {
                    wifi.connectNetwork(network.ssid, network.password)
                        .then(() => {
                            wifiConnected = wifi.isConnected();
                            if (wifiConnected) {
                                io.emit('wifi_connected');
                            } else {
                                io.emit('connection_failed');
                            }
                        })
                        .catch(() => {
                            wifi.findNetworks().then((ssids) => {
                                io.emit('connection_failed');
                            });
                        });
                }, 500)
            }
        } else {
            next();
        }
    });
}