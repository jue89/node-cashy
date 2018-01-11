'use strict';

const fs = require('fs');
const jsongate = require('json-gate');
const dbFactory = require('./database.js');
const objhelper = require('./objhelper.js');

// Opts schema
const optsTest = jsongate.createSchema({
	type: 'object',
	required: true,
	properties: {
		file: { type: 'string', required: true },
		invert: { type: 'string', default: '^$' },
		create: { type: 'boolean', default: true },
		accuracy: { type: 'integer', default: 2, minimum: 0, maximum: 7 }
	},
	additionalProperties: false
});

// Accounting class
function Accounting (opts) {
	// Process opts
	optsTest.validate(opts);
	opts.appidMajor = 0x13370000;
	opts.appidMinor = opts.accuracy;
	opts.appidMinorBits = 3;
	opts.schema = require('./schema.js');
	objhelper.setHiddenProperties(this, {
		_invert: new RegExp(opts.invert)
	});
	delete opts.accuracy;
	delete opts.invert;

	// Connect to database
	objhelper.setHiddenProperties(this, {
		_db: dbFactory(opts)
	});

	// If connection to database has been established, read back accuracy.
	// It might be different from the stated one if the database has been
	// inititalised with a different accuracy.
	this._db.then((db) => {
		objhelper.setImmutableProperties(this, {
			accuracy: db.appidMinor
		});
		objhelper.setHiddenProperties(this, {
			_accuracy: Math.pow(10, db.appidMinor),
			_maxint: Number.MAX_SAFE_INTEGER / Math.pow(10, db.appidMinor)
		});
	}).catch(() => {});
};

// Load class methods from directory
const REjs = /^(.*)\.js$/;
fs.readdirSync(`${__dirname}/accounting/`).forEach((file) => {
	const tmp = REjs.exec(file);
	if (!tmp) return;

	const methodName = tmp[1];
	const method = require(`${__dirname}/accounting/` + file);

	Accounting.prototype[methodName] = function () {
		// Convert aguments to array
		const args = Array.prototype.slice.call(arguments);

		// Get database instance and then call the method with
		// db instance followed by arguments that may have been specified
		return this._db.then((db) => {
			return method.apply(this, [db].concat(args));
		});
	};
});

module.exports = Accounting;
