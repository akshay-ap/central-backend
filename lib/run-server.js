
////////////////////////////////////////////////////////////////////////////////
// DATABASE SETUP

// initialize our top-level static database instance.
const { connect } = require('./model/database');
const db = connect();

// initialize our model objects.
const container = require('./model/package').withDefaults(db);


////////////////////////////////////////////////////////////////////////////////
// START HTTP SERVICE

const service = require('./service')(container);
process.on('message', (message) => { // parent process.
  if (message === 'shutdown') process.exit(0);
  // TODO: do we need to cleanup database?
});
