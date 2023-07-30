//FMC https://firebase.google.com/docs/cloud-messaging/
const fcmAdmin = require('firebase-admin');
const fs = require('fs');

function fcm(i) {
	try {
		let serviceAccount = JSON.parse(fs.readFileSync("FCM/serviceAccountKey.json"));
		fcmAdmin.initializeApp({
			credential: fcmAdmin.credential.cert(serviceAccount),
			databaseURL: 'https://smokerpi-bcb83.firebaseio.com'
		});
	} catch (err) {
		console.log("Warning, failed to initialize FCM: " + err);
	}
	this.fcmTokens = [];
	this.icon = i;
}

fcm.prototype = {
	sendMessage: function (title, body, icon) {
		// Send a message to the device corresponding to the provided
		// registration token.
		let goodTokens = [];
		this.fcmTokens.forEach(function (fcmToken) {
			try {
				let message = {
					token: fcmToken,
					webpush: {
						notification: {
							title: title,
							body: body,
							icon: this.icon
						}
					}
				};
				fcmAdmin.messaging().send(message);
				goodTokens.push(fcmToken);
			} catch (error) {
				console.log('Error sending message:', error);
			};
		});
		this.fcmTokens = goodTokens;
	},
	addFCMListener: function (token) {
		this.fcmTokens.push(token);
	}
}

module.exports = fcm;