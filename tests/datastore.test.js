const fs = require('fs');
const path = require('path');
const db = require('../DataStore/datastore');

describe('datastore', () => {
	test('exposes users, sessions and sessionLogs collections', () => {
		expect(db.users).toBeDefined();
		expect(db.sessions).toBeDefined();
		expect(db.sessionLogs).toBeDefined();
	});

	test('persists and retrieves documents', async () => {
		const inserted = await db.users.insert({ email: 'ds@test.com', isAdmin: true });
		expect(inserted._id).toBeDefined();
		const found = await db.users.findOne({ email: 'ds@test.com' });
		expect(found).toMatchObject({ email: 'ds@test.com', isAdmin: true });
	});

	test('writes data files into DATA_DIR', async () => {
		await db.sessionLogs.insert({ sessionName: 'x', currBbqTemp: '1.0' });
		// nedb appends asynchronously; allow the write to flush.
		await new Promise((r) => setTimeout(r, 50));
		expect(fs.existsSync(path.join(process.env.DATA_DIR, 'logs.db'))).toBe(true);
	});
});
