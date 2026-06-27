jest.mock('../backend'); // never hit the real hardware backend during tests

const request = require('supertest');
const bcrypt = require('bcryptjs');
const { app } = require('../app');
const db = require('../DataStore/datastore');
const monitor = require('../bbqMonitor');

async function createUser(email, password, isAdmin = false) {
	const hash = await bcrypt.hash(password, 10);
	return db.users.insert({ email, password: hash, isAdmin });
}

async function loginAs(email, password) {
	const agent = request.agent(app);
	await agent.post('/users/login').type('form').send({ email, password });
	return agent;
}

afterAll(() => {
	monitor.stopTimer();
});

beforeEach(() => {
	// Reset shared monitor state so tests don't leak into each other.
	monitor.isSessionComplete = false;
	monitor.isSessionStarted = true;
	monitor.blowerState = 'off';
	monitor.logState = 'off';
	monitor.setSessionName('2024-01-02-Test');
});

describe('infrastructure routes', () => {
	test('GET /health-check returns 200', async () => {
		const res = await request(app).get('/health-check');
		expect(res.status).toBe(200);
	});

	test('unknown routes redirect home', async () => {
		const res = await request(app).get('/does-not-exist');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/');
	});
});

describe('public pages', () => {
	test('GET / renders the welcome page when logged out', async () => {
		const res = await request(app).get('/');
		expect(res.status).toBe(200);
		expect(res.text).toContain('SmokerPi');
	});

	test('GET /users/login renders the login page', async () => {
		const res = await request(app).get('/users/login');
		expect(res.status).toBe(200);
		expect(res.text).toContain('Login');
	});

	test('GET /users/register renders the register page', async () => {
		const res = await request(app).get('/users/register');
		expect(res.status).toBe(200);
		expect(res.text).toContain('Register');
	});
});

describe('registration', () => {
	test('rejects mismatched passwords by re-rendering the form', async () => {
		const res = await request(app).post('/users/register').type('form').send({
			email: 'mismatch@test.com',
			password: 'password1',
			confirmpassword: 'password2'
		});
		expect(res.status).toBe(200);
		expect(res.text).toContain('Register');
	});

	test('redirects to login on a valid registration', async () => {
		const res = await request(app).post('/users/register').type('form').send({
			email: 'newuser@test.com',
			password: 'password1',
			confirmpassword: 'password1'
		});
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('login');
	});

	test('rejects an already-registered email', async () => {
		await createUser('dupe@test.com', 'password1');
		const res = await request(app).post('/users/register').type('form').send({
			email: 'dupe@test.com',
			password: 'password1',
			confirmpassword: 'password1'
		});
		expect(res.status).toBe(200);
		expect(res.text).toContain('Register');
	});
});

describe('login', () => {
	test('re-renders the form when fields are missing', async () => {
		const res = await request(app).post('/users/login').type('form').send({
			email: 'someone@test.com'
		});
		expect(res.status).toBe(200);
		expect(res.text).toContain('Login');
	});

	test('redirects back to login on bad credentials', async () => {
		await createUser('wrongpass@test.com', 'password1');
		const res = await request(app).post('/users/login').type('form').send({
			email: 'wrongpass@test.com',
			password: 'not-the-password'
		});
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/users/login');
	});

	test('redirects to the dashboard on success', async () => {
		await createUser('good@test.com', 'password1');
		const res = await request(app).post('/users/login').type('form').send({
			email: 'good@test.com',
			password: 'password1'
		});
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/session/dashboard');
	});
});

describe('session routes require authentication', () => {
	test('GET /session/new redirects to login when unauthenticated', async () => {
		const res = await request(app).get('/session/new');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/users/login');
	});
});

describe('authenticated non-admin user', () => {
	let agent;
	beforeAll(async () => {
		await createUser('member@test.com', 'password1', false);
		agent = await loginAs('member@test.com', 'password1');
	});

	test('GET / redirects an authenticated user to the dashboard', async () => {
		const res = await agent.get('/');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/session/dashboard');
	});

	test('GET /session/dashboard redirects to the named dashboard', async () => {
		const res = await agent.get('/session/dashboard');
		expect(res.status).toBe(302);
		expect(res.headers.location).toContain('/session/dashboard/');
	});

	test('GET /session/dashboard/:name renders the dashboard', async () => {
		const res = await agent.get('/session/dashboard/2024-01-02-Test');
		expect(res.status).toBe(200);
		expect(res.text).toContain('Smoker:');
	});

	test('GET /session/loadChartData/:name returns JSON', async () => {
		const res = await agent.get('/session/loadChartData/2024-01-02-Test');
		expect(res.status).toBe(200);
		expect(Array.isArray(res.body)).toBe(true);
	});

	test('POST /session/new is rejected for non-admins', async () => {
		const res = await agent.post('/session/new').type('form').send({
			sessionName: '2024-01-02-Ribs',
			period: 5,
			targetTemp: 230,
			alertHigh: 245,
			alertLow: 225,
			alertMeat: 195
		});
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/session/new');
	});
});

describe('authenticated admin user', () => {
	let agent;
	beforeAll(async () => {
		await createUser('admin@test.com', 'password1', true);
		agent = await loginAs('admin@test.com', 'password1');
	});

	test('GET /session/new renders the new-session form', async () => {
		monitor.isSessionStarted = false;
		const res = await agent.get('/session/new');
		expect(res.status).toBe(200);
		expect(res.text).toContain('New Session');
	});

	test('GET /session/dashboard redirects admin to /new when no session started', async () => {
		monitor.isSessionStarted = false;
		const res = await agent.get('/session/dashboard');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/session/new');
	});

	test('POST /session/new with valid data starts a session', async () => {
		const res = await agent.post('/session/new').type('form').send({
			sessionName: '2024-03-03-Pork',
			period: 10,
			targetTemp: 225,
			alertHigh: 240,
			alertLow: 210,
			alertMeat: 190
		});
		expect(res.status).toBe(302);
		expect(res.headers.location).toContain('/session/dashboard/');
		expect(monitor.isSessionStarted).toBe(true);
		expect(monitor.sessionName).toBe('2024-03-03-Pork');
		expect(monitor.targetTemp).toBe('225');
	});

	test('POST /session/new with invalid data re-renders the form', async () => {
		const res = await agent.post('/session/new').type('form').send({
			sessionName: 'not-a-valid-name',
			period: 5,
			targetTemp: 230,
			alertHigh: 245,
			alertLow: 225,
			alertMeat: 195
		});
		expect(res.status).toBe(200);
		expect(res.text).toContain('New Session');
	});

	test('POST /session/dashboard ends the session', async () => {
		const res = await agent.post('/session/dashboard');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/session/complete');
		expect(monitor.isSessionStarted).toBe(false);
	});

	test('GET /session/complete renders and resets blower/log state', async () => {
		monitor.blowerState = 'on';
		monitor.logState = 'on';
		const res = await agent.get('/session/complete');
		expect(res.status).toBe(200);
		expect(res.text).toContain('Session Complete');
		expect(monitor.blowerState).toBe('off');
		expect(monitor.logState).toBe('off');
		expect(monitor.isSessionComplete).toBe(true);
	});

	test('GET /users/logout logs out and redirects to login', async () => {
		const res = await agent.get('/users/logout');
		expect(res.status).toBe(302);
		expect(res.headers.location).toBe('/users/login');
	});
});
