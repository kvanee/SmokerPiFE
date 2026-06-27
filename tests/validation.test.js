const validate = require('validate.js');
const registrationConstraints = require('../validation/registration');
const sessionConstraints = require('../validation/session');

describe('registration constraints', () => {
	test('accepts a valid registration', () => {
		const errors = validate({
			email: 'user@example.com',
			password: 'password1',
			confirmpassword: 'password1'
		}, registrationConstraints);
		expect(errors).toBeUndefined();
	});

	test('rejects a missing email', () => {
		const errors = validate({
			password: 'password1',
			confirmpassword: 'password1'
		}, registrationConstraints);
		expect(errors).toHaveProperty('email');
	});

	test('rejects an invalid email format', () => {
		const errors = validate({
			email: 'not-an-email',
			password: 'password1',
			confirmpassword: 'password1'
		}, registrationConstraints);
		expect(errors).toHaveProperty('email');
	});

	test('rejects a password shorter than 6 characters', () => {
		const errors = validate({
			email: 'user@example.com',
			password: 'short',
			confirmpassword: 'short'
		}, registrationConstraints);
		expect(errors).toHaveProperty('password');
	});

	test('rejects a confirmpassword that does not match', () => {
		const errors = validate({
			email: 'user@example.com',
			password: 'password1',
			confirmpassword: 'password2'
		}, registrationConstraints);
		expect(errors).toHaveProperty('confirmpassword');
	});

	test('skips confirmpassword equality when it is omitted (login reuse)', () => {
		const errors = validate({
			email: 'user@example.com',
			password: 'password1'
		}, registrationConstraints);
		expect(errors).toBeUndefined();
	});
});

describe('session constraints', () => {
	const valid = {
		sessionName: '2024-01-02-Brisket',
		period: 5,
		targetTemp: 230,
		alertHigh: 245,
		alertLow: 225,
		alertMeat: 195
	};

	test('accepts a valid session', () => {
		expect(validate(valid, sessionConstraints)).toBeUndefined();
	});

	test('rejects a malformed session name', () => {
		const errors = validate({ ...valid, sessionName: 'brisket' }, sessionConstraints);
		expect(errors).toHaveProperty('sessionName');
	});

	test('rejects a period of 60 or more', () => {
		const errors = validate({ ...valid, period: 60 }, sessionConstraints);
		expect(errors).toHaveProperty('period');
	});

	test('rejects a period below 1', () => {
		const errors = validate({ ...valid, period: 0 }, sessionConstraints);
		expect(errors).toHaveProperty('period');
	});

	test('rejects a target temp of 400 or more', () => {
		const errors = validate({ ...valid, targetTemp: 400 }, sessionConstraints);
		expect(errors).toHaveProperty('targetTemp');
	});

	test('rejects a non-positive alertLow', () => {
		const errors = validate({ ...valid, alertLow: 0 }, sessionConstraints);
		expect(errors).toHaveProperty('alertLow');
	});

	test('rejects a missing alertMeat', () => {
		const { alertMeat, ...withoutMeat } = valid;
		const errors = validate(withoutMeat, sessionConstraints);
		expect(errors).toHaveProperty('alertMeat');
	});
});
