module.exports = {
	testEnvironment: 'node',
	setupFiles: ['<rootDir>/tests/setup.js'],
	testMatch: ['<rootDir>/tests/**/*.test.js'],
	// nedb writes to the filesystem; run serially so test files don't contend
	// over the same data directory.
	maxWorkers: 1,
	// Surface any handles (timers/sockets) we forget to clean up.
	detectOpenHandles: false,
	clearMocks: true
};
