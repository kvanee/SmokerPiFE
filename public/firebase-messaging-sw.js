importScripts("https://www.gstatic.com/firebasejs/4.13.0/firebase-app.js")
importScripts("https://www.gstatic.com/firebasejs/4.13.0/firebase-messaging.js")

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