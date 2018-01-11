'use strict';

const jsongate = require('json-gate');
const SQLite = require('./sqlite.js');
const objhelper = require('./objhelper.js');

// Opts schema:
// - file: SQLite datebase file
// - create: If set to false, the lib won't create a new database if not present
// - appidMajor: Application ID. Must match and will throw an exception if not matching
// - appidMinor: Can be different and won't throw an exception if it does not match. Can be read back from return object.
// - appidMinorBits: Amount of bits associated to appidMinor
// - schema: Database schema array
const optsTest = jsongate.createSchema({
	type: 'object',
	properties: {
		file: { type: 'string', required: true },
		create: { type: 'boolean', default: true },
		appidMajor: { type: 'integer', default: 0x1337bee0, maximum: 0x7fffffff, minimum: 0x0 },
		appidMinor: { type: 'integer', default: 0x0, maximum: 0x7fffffff, minimum: 0x0 },
		appidMinorBits: { type: 'integer', default: 0, maximum: 31, minimum: 0 },
		schema: { type: 'array', default: [] }
	},
	additionalProperties: false
});

module.exports = function (opts) {
	let db;
	return new Promise((resolve, reject) => {
		// Validate options
		optsTest.validate(opts);

		// Set mode
		let mode = SQLite.OPEN_READWRITE;
		if (opts.create) mode |= SQLite.OPEN_CREATE;

		db = new SQLite(opts.file, mode, (err) => {
			if (err) return reject(err);
			else resolve();
		});
	}).then(() => Promise.all([
		// If database is empty (no tables + application_id == 0 + user_version == 0)
		// -> Init database
		db.get('PRAGMA application_id;'),
		db.get('SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table'),
		db.get('PRAGMA user_version;'),
		db.run('PRAGMA foreign_keys=ON;'),
		db.run('PRAGMA case_sensitive_like=ON;')
	])).then((res) => {
		// Application ID handling
		const appidMajorMask = (Math.pow(2, 32 - opts.appidMinorBits) - 1) << opts.appidMinorBits;
		const appidMinorMask = Math.pow(2, opts.appidMinorBits) - 1;
		const appidMajor = res[0].application_id & appidMajorMask;
		const appidMinor = res[0].application_id & appidMinorMask;
		opts.appidMajor = opts.appidMajor & appidMajorMask;
		opts.appidMinor = opts.appidMinor & appidMinorMask;
		const tblcnt = res[1].tblcnt;
		const userVersion = res[2].user_version;

		// Database is not emptry and major app id does not match -> reject
		if (tblcnt !== 0 && appidMajor !== opts.appidMajor) {
			return Promise.reject(new Error('Not a valid database: Wrong application ID.'));
		}

		// Appid is matching! Everything is fine
		if (appidMajor === opts.appidMajor) {
			// Store app IDs in database object
			objhelper.setImmutableProperties(db, {
				appidMajor: appidMajor,
				appidMinor: appidMinor
			});
			return userVersion;
		}

		// New database: Set app id
		return db.run(
			`PRAGMA application_id=${opts.appidMajor + opts.appidMinor};`
		).then(() => {
			// Store app IDs in database object
			objhelper.setImmutableProperties(db, {
				appidMajor: opts.appidMajor,
				appidMinor: opts.appidMinor
			});
			return userVersion;
		});
	}).then((schemaversion) => {
		return applySchema(schemaversion, opts.schema);
		function applySchema (schemaversion, schema) {
			// Schema is up to date
			if (schemaversion / 2 === schema.length) return;

			// Error occured during migration
			if (schemaversion % 2 !== 0) {
				return Promise.reject(new Error('Database is an unsafe state. Last update failed!'));
			}

			// Schema is unknown
			if (schemaversion / 2 > schema.length) {
				return Promise.reject(new Error('Schema format from future: Update tool to the latest version.'));
			}

			// Before running the migration code, increase the schema version.
			// This indicates that the database might be in an unsafe state.
			const i = schemaversion / 2;
			return db.run(`PRAGMA user_version=${++schemaversion};`)
				.then(() => schema[i](db))
				.then(() => db.run(`PRAGMA user_version=${++schemaversion};`))
				.then(() => {
					// Recursively call apply schema if we haven't finised yet
					if (schemaversion / 2 < schema.length) {
						return applySchema(schemaversion, schema);
					}
				});
		}
	}).then(() => db);
};
