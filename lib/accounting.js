'use strict';

const jsongate = require( 'json-gate' );
const dbFactory = require( './database.js' );

// Opts schema
const optsTest = jsongate.createSchema( {
	type: 'object',
	properties: {
		file: { type: 'string', required: true },
		accuracy: { type: 'integer', default: 2, minimum: 0, maximum: 4 }
	},
	additionalProperties: false
} );

class Accounting {

	constructor( opts ) {

		// Process opts
		optsTest.validate( opts );
		opts.appid = 0x13370000 + opts.accuracy;
		delete opts.accuracy;
		opts.schema = require( './schema.js' );

		// Connect to database
		this._db = dbFactory( opts );

	}

}

module.exports = Accounting;
