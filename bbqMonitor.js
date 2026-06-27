const date = require('date-and-time');
const backend = require('./backend');
const db = require("./DataStore/datastore");

const BBQMonitorSingleton = (function () {
	let instance;
	class BBQMonitor {
		constructor() {
			/*Interval to check temp and adjust blower*/
			this.period = 5;
			this.handlers = [];
			this.sessionNameSubscribers = [];
			this.sessionName = date.format(new Date(), 'YYYY-MM-DD') + "-Meat";
			this.targetTemp = 230;
			this.alertHigh = 245;
			this.alertLow = 225;
			this.alertMeat = 195;
			this.isBlowerOn = false;
			this.blowerState = "off";
			this.logState = "off";
			this.currBbqTemp = -99;
			this.currMeatTemp = -99;
			this.isSessionStarted = false;
			this.isSessionComplete = false;
			// Set once the smoker first reaches the low threshold, so we don't
			// fire "too cool" alerts while it's still warming up from cold.
			this.warmedUp = false;
			this.setupTimer(this.period);
		}

		// Reset per-cook alert state at the start of a new session.
		startSession() {
			this.isSessionStarted = true;
			this.isSessionComplete = false;
			this.warmedUp = false;
		}

		// Evaluate the current temperatures against the configured thresholds.
		// Only alerts during an active cook. Returns the temperature problem
		// (too hot / too cool) and a separate "meat reached target" signal.
		evaluateAlert() {
			const active = this.isSessionStarted && !this.isSessionComplete;
			let alert = { active: false, type: 'none', reason: '' };
			if (active) {
				if (this.currBbqTemp >= this.alertLow) {
					this.warmedUp = true;
				}
				if (this.currBbqTemp > this.alertHigh) {
					alert = {
						active: true,
						type: 'high',
						reason: 'Smoker too hot: ' + this.currBbqTemp.toFixed(1) + '°F (limit ' + this.alertHigh + '°F)'
					};
				} else if (this.warmedUp && this.currBbqTemp < this.alertLow) {
					alert = {
						active: true,
						type: 'low',
						reason: 'Smoker too cool: ' + this.currBbqTemp.toFixed(1) + '°F (limit ' + this.alertLow + '°F)'
					};
				}
			}
			const meatReady = active && this.currMeatTemp >= this.alertMeat;
			return { alert, meatReady };
		}

		setupTimer(period) {
			this.period = period;
			let self = this;
			if (this.interval) {
				clearInterval(this.interval);
			}
			this.interval = setInterval(() => {
				this.monitorTemp(self)
			}, period * 1000);
		}

		stopTimer() {
			if (this.interval) {
				clearInterval(this.interval);
				this.interval = null;
			}
		}

		setSessionName(name) {
			this.sessionName = name;
			this.sessionNameSubscribers.forEach((subscriber) => {
				subscriber(name);
			});
		}

		updateBlowerGPIO() {
			if (((this.currBbqTemp < this.targetTemp) && this.blowerState == "auto") || this.blowerState == "on") {
				backend.setBlower("true");
				this.isBlowerOn = true;
			} else {
				backend.setBlower("false");
				this.isBlowerOn = false;
			}
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

		async getPastSessions(callback) {
			data = await db.sessions.find({})
				.sort({
					startDate: 1
				})
				.limit(10);
			callback(data);
		}

		subscribe(fn) {
			this.handlers.push(fn);
		}

		onSessionNameUpdate(fn) {
			this.sessionNameSubscribers.push(fn);
		}

		async monitorTemp(self) {
			let res = await backend.getTemp();
			if (!res) {
				console.log("Error getting temp");
			}
			else{
			self.currBbqTemp = res.bbq;
			self.currMeatTemp = res.meat;
			self.updateBlowerGPIO();
			let now = new Date();
			let { alert, meatReady } = self.evaluateAlert();
			let data = {
				sessionName: self.sessionName,
				date: date.format(now, 'YYYY/MM/DD'),
				time: date.format(now, 'HH:mm:ss'),
				logState: self.logState,
				currBbqTemp: self.currBbqTemp.toFixed(1),
				currMeatTemp: self.currMeatTemp.toFixed(1),
				targetTemp: self.targetTemp,
				isBlowerOn: self.isBlowerOn,
				alertActive: alert.active,
				alertType: alert.type,
				alertReason: alert.reason,
				meatReady: meatReady
			};
			if (self.logState == "on") {
				db.sessionLogs.insert(data);
			}
			self.handlers.forEach((subscriber) => {
				subscriber(data);
			});
		}
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