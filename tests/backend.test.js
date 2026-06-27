jest.mock('axios');
const axios = require('axios');
const backend = require('../backend');

// BACKEND_URL is set to http://backend.test:3081 in tests/setup.js
const BASE = 'http://backend.test:3081';

describe('backend.getTemp', () => {
	test('requests the temp endpoint and returns the response data', async () => {
		axios.get.mockResolvedValue({ data: { bbq: 212.3, meat: 150.1 } });
		const result = await backend.getTemp();
		expect(axios.get).toHaveBeenCalledWith(BASE + '/getTemp');
		expect(result).toEqual({ bbq: 212.3, meat: 150.1 });
	});

	test('returns undefined and does not throw when the request fails', async () => {
		axios.get.mockRejectedValue(new Error('network down'));
		const result = await backend.getTemp();
		expect(result).toBeUndefined();
	});
});

describe('backend.setBlower', () => {
	test('requests the blower endpoint with the given state', () => {
		axios.get.mockResolvedValue({ data: 'ok' });
		backend.setBlower('true');
		expect(axios.get).toHaveBeenCalledWith(BASE + '/setBlower/true');
	});

	test('swallows errors from the blower endpoint', () => {
		axios.get.mockRejectedValue(new Error('network down'));
		expect(() => backend.setBlower('false')).not.toThrow();
	});
});
