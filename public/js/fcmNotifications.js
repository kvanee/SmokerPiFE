const socket = io();
// Initialize Firebase
const config = {
	apiKey: "AIzaSyCQCQy04c6BD2x89rc9ZemaPfdBq0IuXNU",
	authDomain: "smokerpi-bcb83.firebaseapp.com",
	databaseURL: "https://smokerpi-bcb83.firebaseio.com",
	projectId: "smokerpi-bcb83",
	storageBucket: "smokerpi-bcb83.appspot.com",
	messagingSenderId: "767940779076"
};
firebase.initializeApp(config);
const messaging = firebase.messaging();
messaging.usePublicVapidKey("BE0cdDlG2Aq-zi7P8Q0L9Aicm7MGk-RGVhrIcdS9oauU9A1VkYg_uy-Jl-GlHdSULdI22fhIvA4n9GePuOzlg-U");
messaging.requestPermission().then(function () {
		console.log("Permission Granted");
		return messaging.getToken();
	}).then(function (token) {
		console.log(token);
		socket.emit('setFcmToken', token);
	})
	.catch(function (err) {
		console.log("FCM Error" + err);
	});

messaging.onMessage(function (payload) {
	console.log('onMessage: ' + payload);
});

messaging.onTokenRefresh(function () {
	messaging.getToken().then(function (refreshedToken) {
		console.log('Token refreshed.');
		socket.emit('setFcmToken', refreshedToken);
	}).catch(function (err) {
		console.log('Unable to retrieve refreshed token ', err);
	});
});