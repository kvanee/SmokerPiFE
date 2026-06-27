jest.mock('../backend');

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { io: ioClient } = require('socket.io-client');
const { app, server, io } = require('../app');
const db = require('../DataStore/datastore');
const backend = require('../backend');
const monitor = require('../bbqMonitor');

jest.setTimeout(15000);

let baseURL;
const openSockets = [];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(opts = {}) {
	return new Promise((resolve, reject) => {
		const socket = ioClient(baseURL, { forceNew: true, reconnection: false, ...opts });
		openSockets.push(socket);
		socket.on('connect', () => resolve(socket));
		socket.on('connect_error', reject);
	});
}

function once(socket, event, timeout = 5000) {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error('timed out waiting for ' + event)), timeout);
		socket.once(event, (data) => {
			clearTimeout(t);
			resolve(data);
		});
	});
}

async function adminCookie() {
	const hash = await bcrypt.hash('password1', 10);
	await db.users.insert({ email: 'sockadmin@test.com', password: hash, isAdmin: true });
	const agent = request.agent(app);
	const res = await agent.post('/users/login').type('form')
		.send({ email: 'sockadmin@test.com', password: 'password1' });
	return res.headers['set-cookie'].map((c) => c.split(';')[0]).join('; ');
}

beforeAll((done) => {
	server.listen(0, () => {
		baseURL = 'http://localhost:' + server.address().port;
		done();
	});
});

afterAll((done) => {
	monitor.stopTimer();
	// io.close() also closes the underlying HTTP server.
	io.close(done);
});

afterEach(() => {
	while (openSockets.length) {
		const s = openSockets.pop();
		if (s.connected) s.close();
	}
});

describe('socket connection', () => {
	test('a client can connect', async () => {
		const s = await connect();
		expect(s.connected).toBe(true);
	});
});

describe('settings', () => {
	test('getSettings returns the current monitor settings', async () => {
		const s = await connect();
		await sleep(100);
		const p = once(s, 'updateSettings');
		s.emit('getSettings');
		const data = await p;
		expect(data).toHaveProperty('targetTemp');
		expect(data).toHaveProperty('alertHigh');
		expect(data).toHaveProperty('period');
	});

	test('saveSettings is rejected for a non-admin client', async () => {
		const s = await connect();
		await sleep(100);
		const p = once(s, 'updateFailed');
		s.emit('saveSettings', {
			period: 5, targetTemp: 230, alertHigh: 245, alertLow: 225, alertMeat: 195
		});
		const msg = await p;
		expect(msg).toMatch(/administrator/i);
	});
});

describe('monitor broadcasts', () => {
	test('updateTemp is emitted to clients when the monitor polls', async () => {
		backend.getTemp.mockResolvedValue({ bbq: 200.0, meat: 150.0 });
		const s = await connect();
		await sleep(100);
		const p = once(s, 'updateTemp');
		await monitor.monitorTemp(monitor);
		const data = await p;
		expect(data.currBbqTemp).toBe('200.0');
		expect(data.currMeatTemp).toBe('150.0');
	});

	test('setSessionName is broadcast when the session is renamed', async () => {
		const s = await connect();
		await sleep(100);
		// The client uses this event purely as a signal to reload the dashboard;
		// it ignores the payload, so we assert the event fires and the rename took.
		const p = once(s, 'setSessionName');
		monitor.setSessionName('2024-09-09-Test');
		await p;
		expect(monitor.sessionName).toBe('2024-09-09-Test');
	});
});

describe('admin actions over the socket', () => {
	test('an admin can set the blower state and it is broadcast', async () => {
		const cookie = await adminCookie();
		const adminSock = await connect({ extraHeaders: { Cookie: cookie }, transports: ['polling'] });
		const viewer = await connect();
		await sleep(200); // let the server finish the async auth lookup

		const p = once(viewer, 'setBlowerState');
		adminSock.emit('setBlowerState', { blowerState: 'on' });
		const value = await p;

		expect(value).toBe('on');
		expect(monitor.blowerState).toBe('on');
	});

	test('an admin can save valid settings and they are broadcast', async () => {
		const cookie = await adminCookie();
		const adminSock = await connect({ extraHeaders: { Cookie: cookie }, transports: ['polling'] });
		const viewer = await connect();
		await sleep(200);

		const newSettings = {
			period: 7, targetTemp: 240, alertHigh: 260, alertLow: 200, alertMeat: 198
		};
		const p = once(viewer, 'updateSettings');
		adminSock.emit('saveSettings', newSettings);
		const data = await p;

		expect(data).toMatchObject(newSettings);
		expect(monitor.targetTemp).toBe(240);
	});
});
