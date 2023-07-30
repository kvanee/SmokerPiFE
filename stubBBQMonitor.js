const date = require('date-and-time');
const db = require("./DataStore/dataStore");
let thermometer;
let debugMeatTemp = 70;
let debugSuffix = '';
let rpio;
const BBQMonitorSingleton = (function () {
	let instance;
	class BBQMonitor {
		constructor() {

			this.setupDebug();
			/*Interval to check temp and adjust blower*/
			this.period = 5;
			this.handlers = [];
			this.sessionNameSubscribers = [];
			this.sessionName = date.format(new Date(), 'YYYY-MM-DD') + "-Meat" + debugSuffix;
			this.targetTemp = 230;
			this.alertHigh = 245;
			this.alertLow = 225;
			this.alertMeat = 195;
			this.isBlowerOn = false;
			this.blowerState = "off";
			this.logState = "off";
			this.isSessionStarted = false;
			this.isSessionComplete = false;
			this.currBbqTemp = 0;
			this.currMeatTemp = 0;
			this.setupTimer(this.period);
		}

		setupTimer(period) {
			console.log("setting up timer for " + period + " seconds");
			this.period = period;
			let self = this;
			if (this.interval) {
				clearInterval(this.interval);
			}
			this.interval = setInterval(() => {
				this.monitorTemp(self)
			}, period * 1000);
		}

		setSessionName(name) {
			this.sessionName = name;
			this.sessionNameSubscribers.forEach((subscriber) => {
				subscriber(name);
			});
		}

		setupDebug() {
			console.log("running in debug mode")
			debugSuffix = "-DEBUG"
			thermometer = {
				calcTempF: function (cs) {
					if (!cs)
						return 245 + (Math.random() * 10.0);
					else if (debugMeatTemp > 205) {
						debugMeatTemp = 60;
						return debugMeatTemp;
					} else
						return debugMeatTemp += Math.random();
				}
			};
			rpio = {
				write: function () {}
			};
		}

		updateBlowerGPIO() {

		}

		async getTemperatureLog(sessionName) {
			return db.sessionLogs.find({
					sessionName
				})
				.sort({
					date: 1,
					time: 1
				});
		}

		subscribe(fn) {
			this.handlers.push(fn);
		}

		onSessionNameUpdate(fn) {
			this.sessionNameSubscribers.push(fn);
		}

		monitorTemp(self) {
			self.currBbqTemp = thermometer.calcTempF(0 /*SPI Device 0*/ );
			self.currMeatTemp = thermometer.calcTempF(1 /*SPI Device 1*/ );
			self.updateBlowerGPIO();
			let now = new Date();
			let data = {
				sessionName: self.sessionName,
				date: date.format(now, 'YYYY/MM/DD'),
				time: date.format(now, 'HH:mm:ss'),
				logState: self.logState,
				currBbqTemp: self.currBbqTemp.toFixed(1),
				currMeatTemp: self.currMeatTemp.toFixed(1),
				targetTemp: self.targetTemp,
				isBlowerOn: self.isBlowerOn
			};
			if (self.logState == "on") {
				db.sessionLogs.insert(data);
			}
			self.handlers.forEach((subscriber) => {
				subscriber(data);
			});
		}
	};
	return {
		getInstance: function () {
			if (!instance) {
				instance = new BBQMonitor();
			}
			return instance;
		}
	}
})();

module.exports = BBQMonitorSingleton.getInstance();