const { isAdmin, authenticate, authenticateAdmin } = require('../config/authenticate');

function mockRes() {
	return {
		redirectedTo: null,
		redirect(url) { this.redirectedTo = url; }
	};
}

function mockReq(user, originalUrl = '/session/new') {
	return {
		user,
		originalUrl,
		flashes: [],
		flash(type, msg) { this.flashes.push({ type, msg }); }
	};
}

describe('isAdmin', () => {
	test('false for undefined user', () => {
		expect(isAdmin(undefined)).toBeFalsy();
	});
	test('false for a non-admin user', () => {
		expect(isAdmin({ isAdmin: false })).toBe(false);
	});
	test('true for an admin user', () => {
		expect(isAdmin({ isAdmin: true })).toBe(true);
	});
});

describe('authenticate middleware', () => {
	test('calls next when a user is present', () => {
		const req = mockReq({ email: 'a@b.com' });
		const res = mockRes();
		const next = jest.fn();
		authenticate(req, res, next);
		expect(next).toHaveBeenCalled();
		expect(res.redirectedTo).toBeNull();
	});

	test('redirects to login when no user', () => {
		const req = mockReq(undefined);
		const res = mockRes();
		const next = jest.fn();
		authenticate(req, res, next);
		expect(next).not.toHaveBeenCalled();
		expect(res.redirectedTo).toBe('/users/login');
		expect(req.flashes[0]).toMatchObject({ type: 'error' });
	});
});

describe('authenticateAdmin middleware', () => {
	test('calls next for an admin user', () => {
		const req = mockReq({ email: 'a@b.com', isAdmin: true });
		const res = mockRes();
		const next = jest.fn();
		authenticateAdmin(req, res, next);
		expect(next).toHaveBeenCalled();
	});

	test('redirects a non-admin user back to the original url', () => {
		const req = mockReq({ email: 'a@b.com', isAdmin: false }, '/session/new');
		const res = mockRes();
		const next = jest.fn();
		authenticateAdmin(req, res, next);
		expect(next).not.toHaveBeenCalled();
		expect(res.redirectedTo).toBe('/session/new');
		expect(req.flashes[0]).toMatchObject({ type: 'error' });
	});

	test('redirects an unauthenticated user', () => {
		const req = mockReq(undefined, '/session/new');
		const res = mockRes();
		const next = jest.fn();
		authenticateAdmin(req, res, next);
		expect(next).not.toHaveBeenCalled();
		expect(res.redirectedTo).toBe('/session/new');
	});
});
