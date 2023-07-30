//DB
const Datastore = require('nedb-promises');
const db = {
    users: new Datastore({
        filename: './users.db',
        //autoload: true
    }),
    sessions: new Datastore({
        filename: './session.db',
        //autoload: true
    }),
    sessionLogs: new Datastore({
        filename: './logs.db',
        //autoload: true
    })
};
module.exports = db;