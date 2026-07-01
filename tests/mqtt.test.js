jest.mock('../backend'); // monitor's polling timer must not hit real hardware

// Mock the mqtt client so no real broker connection is attempted.
const mockClient = {
	connected: true,
	handlers: {},
	on: jest.fn(function (event, cb) { mockClient.handlers[event] = cb; return mockClient; }),
	publish: jest.fn()
};
jest.mock('mqtt', () => ({ connect: jest.fn(() => mockClient) }));

const mqtt = require('mqtt');
const monitor = require('../bbqMonitor');
const initMqtt = require('../config/mqtt');

afterAll(() => {
	monitor.stopTimer();
});

beforeEach(() => {
	jest.clearAllMocks();
	mockClient.handlers = {};
	mockClient.connected = true;
	monitor.handlers = [];
	delete process.env.MQTT_URL;
	delete process.env.MQTT_TOPIC_PREFIX;
	delete process.env.MQTT_USERNAME;
	delete process.env.MQTT_PASSWORD;
});

describe('mqtt integration', () => {
	test('is skipped when MQTT_URL is not configured', () => {
		const client = initMqtt();
		expect(client).toBeNull();
		expect(mqtt.connect).not.toHaveBeenCalled();
		expect(monitor.handlers).toHaveLength(0);
	});

	test('connects and publishes availability + discovery on connect', () => {
		process.env.MQTT_URL = 'mqtt://user:pass@localhost:1883';
		initMqtt();
		expect(mqtt.connect).toHaveBeenCalledTimes(1);

		// Simulate the broker connection being established.
		mockClient.handlers.connect();

		expect(mockClient.publish).toHaveBeenCalledWith(
			'smokerpi/availability', 'online', expect.objectContaining({ retain: true })
		);
		const discovery = mockClient.publish.mock.calls.filter((c) => c[0].endsWith('/config'));
		expect(discovery.length).toBe(6); // bbq, meat, target, blower, alert, meat_ready
		// Discovery configs must be retained so HA recovers them after a restart.
		discovery.forEach((c) => expect(c[2]).toEqual(expect.objectContaining({ retain: true })));
	});

	test('publishes a state snapshot on each monitor tick', () => {
		process.env.MQTT_URL = 'mqtt://localhost:1883';
		initMqtt();
		mockClient.publish.mockClear();

		monitor.handlers.forEach((h) => h({
			currBbqTemp: '260.0', currMeatTemp: '150.0', targetTemp: 230,
			isBlowerOn: true, alertActive: true, alertType: 'high',
			alertReason: 'Smoker too hot', meatReady: false, sessionName: '2024-01-02-Test'
		}));

		const stateCall = mockClient.publish.mock.calls.find((c) => c[0] === 'smokerpi/state');
		expect(stateCall).toBeDefined();
		const payload = JSON.parse(stateCall[1]);
		expect(payload.bbq).toBe(260);
		expect(payload.blower).toBe('ON');
		expect(payload.alert).toBe('ON');
		expect(payload.alert_type).toBe('high');
	});

	test('passes MQTT_USERNAME/MQTT_PASSWORD as connect options (avoids URL mangling)', () => {
		process.env.MQTT_URL = 'mqtt://10.0.10.3:1883';
		process.env.MQTT_USERNAME = 'smokerpi';
		process.env.MQTT_PASSWORD = 'p@ss:w/rd#123';
		initMqtt();
		const opts = mqtt.connect.mock.calls[0][1];
		expect(opts.username).toBe('smokerpi');
		expect(opts.password).toBe('p@ss:w/rd#123');
	});

	test('honors a custom topic prefix', () => {
		process.env.MQTT_URL = 'mqtt://localhost:1883';
		process.env.MQTT_TOPIC_PREFIX = 'bbq';
		initMqtt();
		mockClient.handlers.connect();
		expect(mockClient.publish).toHaveBeenCalledWith(
			'bbq/availability', 'online', expect.any(Object)
		);
	});
});
