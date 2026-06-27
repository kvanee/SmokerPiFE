jest.mock('../backend');
jest.mock('../DataStore/datastore', () => ({
	users: { findOne: jest.fn(), insert: jest.fn() },
	sessions: { find: jest.fn() },
	sessionLogs: {
		insert: jest.fn(),
		find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([{ currBbqTemp: '200.0' }]) }))
	}
}));

const backend = require('../backend');
const db = require('../DataStore/datastore');
const monitor = require('../bbqMonitor');

afterAll(() => {
	monitor.stopTimer();
});

beforeEach(() => {
	monitor.handlers = [];
	monitor.sessionNameSubscribers = [];
	monitor.logState = 'off';
	monitor.blowerState = 'off';
});

describe('default configuration', () => {
	test('has the expected smoker defaults', () => {
		expect(monitor.targetTemp).toBe(230);
		expect(monitor.alertHigh).toBe(245);
		expect(monitor.alertLow).toBe(225);
		expect(monitor.alertMeat).toBe(195);
		expect(monitor.period).toBe(5);
	});
});

describe('setSessionName', () => {
	test('updates the name and notifies subscribers', () => {
		const sub = jest.fn();
		monitor.onSessionNameUpdate(sub);
		monitor.setSessionName('2024-05-05-Ribs');
		expect(monitor.sessionName).toBe('2024-05-05-Ribs');
		expect(sub).toHaveBeenCalledWith('2024-05-05-Ribs');
	});
});

describe('monitorTemp', () => {
	test('reads temps from the backend and notifies handlers', async () => {
		backend.getTemp.mockResolvedValue({ bbq: 212.0, meat: 145.0 });
		const handler = jest.fn();
		monitor.subscribe(handler);

		await monitor.monitorTemp(monitor);

		expect(monitor.currBbqTemp).toBe(212.0);
		expect(monitor.currMeatTemp).toBe(145.0);
		expect(handler).toHaveBeenCalledTimes(1);
		const data = handler.mock.calls[0][0];
		expect(data.currBbqTemp).toBe('212.0');
		expect(data.currMeatTemp).toBe('145.0');
	});

	test('logs to the database only when logState is on', async () => {
		backend.getTemp.mockResolvedValue({ bbq: 200.0, meat: 140.0 });

		monitor.logState = 'off';
		await monitor.monitorTemp(monitor);
		expect(db.sessionLogs.insert).not.toHaveBeenCalled();

		monitor.logState = 'on';
		await monitor.monitorTemp(monitor);
		expect(db.sessionLogs.insert).toHaveBeenCalledTimes(1);
	});

	test('does nothing harmful when the backend returns no data', async () => {
		backend.getTemp.mockResolvedValue(undefined);
		monitor.currBbqTemp = 111;
		const handler = jest.fn();
		monitor.subscribe(handler);

		await monitor.monitorTemp(monitor);

		expect(handler).not.toHaveBeenCalled();
		expect(monitor.currBbqTemp).toBe(111); // unchanged
	});
});

describe('updateBlowerGPIO', () => {
	test('turns the blower on when blowerState is "on"', () => {
		monitor.blowerState = 'on';
		monitor.updateBlowerGPIO();
		expect(backend.setBlower).toHaveBeenLastCalledWith('true');
		expect(monitor.isBlowerOn).toBe(true);
	});

	test('turns the blower off when blowerState is "off"', () => {
		monitor.blowerState = 'off';
		monitor.updateBlowerGPIO();
		expect(backend.setBlower).toHaveBeenLastCalledWith('false');
		expect(monitor.isBlowerOn).toBe(false);
	});

	test('in auto mode, turns on when below target temp', () => {
		monitor.blowerState = 'auto';
		monitor.targetTemp = 230;
		monitor.currBbqTemp = 200;
		monitor.updateBlowerGPIO();
		expect(backend.setBlower).toHaveBeenLastCalledWith('true');
		expect(monitor.isBlowerOn).toBe(true);
	});

	test('in auto mode, turns off when at or above target temp', () => {
		monitor.blowerState = 'auto';
		monitor.targetTemp = 230;
		monitor.currBbqTemp = 240;
		monitor.updateBlowerGPIO();
		expect(backend.setBlower).toHaveBeenLastCalledWith('false');
		expect(monitor.isBlowerOn).toBe(false);
	});
});

describe('getTemperatureLog', () => {
	test('queries the session logs for the given session name', async () => {
		const result = await monitor.getTemperatureLog('2024-05-05-Ribs');
		expect(db.sessionLogs.find).toHaveBeenCalledWith({ sessionName: '2024-05-05-Ribs' });
		expect(Array.isArray(result)).toBe(true);
	});
});

describe('stopTimer', () => {
	test('clears the polling interval', () => {
		monitor.setupTimer(5);
		expect(monitor.interval).not.toBeNull();
		monitor.stopTimer();
		expect(monitor.interval).toBeNull();
	});
});

describe('evaluateAlert', () => {
	beforeEach(() => {
		monitor.isSessionStarted = true;
		monitor.isSessionComplete = false;
		monitor.warmedUp = false;
		monitor.alertHigh = 245;
		monitor.alertLow = 225;
		monitor.alertMeat = 195;
		monitor.currBbqTemp = 230;
		monitor.currMeatTemp = 150;
	});

	test('does not alert when no session is active', () => {
		monitor.isSessionStarted = false;
		monitor.currBbqTemp = 300;
		expect(monitor.evaluateAlert().alert.active).toBe(false);
	});

	test('flags the smoker being too hot', () => {
		monitor.currBbqTemp = 260;
		const { alert } = monitor.evaluateAlert();
		expect(alert.active).toBe(true);
		expect(alert.type).toBe('high');
	});

	test('does not flag "too cool" while still warming up from cold', () => {
		monitor.warmedUp = false;
		monitor.currBbqTemp = 100;
		expect(monitor.evaluateAlert().alert.active).toBe(false);
	});

	test('flags "too cool" once it has warmed up and then drops', () => {
		monitor.currBbqTemp = 230; // >= alertLow marks it warmed up
		monitor.evaluateAlert();
		monitor.currBbqTemp = 200; // now below alertLow
		const { alert } = monitor.evaluateAlert();
		expect(alert.active).toBe(true);
		expect(alert.type).toBe('low');
	});

	test('signals when the meat reaches its target', () => {
		monitor.currMeatTemp = 200;
		expect(monitor.evaluateAlert().meatReady).toBe(true);
	});

	test('monitorTemp includes the alert fields in the emitted data', async () => {
		monitor.warmedUp = true;
		backend.getTemp.mockResolvedValue({ bbq: 260.0, meat: 150.0 });
		const handler = jest.fn();
		monitor.subscribe(handler);
		await monitor.monitorTemp(monitor);
		const data = handler.mock.calls[0][0];
		expect(data.alertActive).toBe(true);
		expect(data.alertType).toBe('high');
		expect(data.meatReady).toBe(false);
	});
});
