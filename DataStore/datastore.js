//DB
const path = require('path');
const Datastore = require('nedb-promises');

// Directory where the nedb data files live. On Dokku the container filesystem is
// ephemeral, so point DATA_DIR at a mounted persistent volume to keep data
// across deploys. Defaults to the app root for local development.
const dataDir = process.env.DATA_DIR || '.';

const db = {
    users: new Datastore({
        filename: path.join(dataDir, 'users.db'),
        //autoload: true
    }),
    sessions: new Datastore({
        filename: path.join(dataDir, 'session.db'),
        //autoload: true
    }),
    sessionLogs: new Datastore({
        filename: path.join(dataDir, 'logs.db'),
        //autoload: true
    })
};
module.exports = db;
