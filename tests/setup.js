// Runs before each test file's modules are loaded. Point the nedb data files at
// an isolated temp directory per test file and provide deterministic config so
// the app never touches real data or external services during tests.
const fs = require('fs');
const os = require('os');
const path = require('path');

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smokerpi-test-'));

process.env.DATA_DIR = dataDir;
process.env.SESSION_SECRET = 'test-secret';
process.env.BACKEND_URL = 'http://backend.test:3081';
process.env.NODE_ENV = 'test';
