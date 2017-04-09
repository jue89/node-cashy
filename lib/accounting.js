'use strict';

const fs = require( 'fs' );
const jsongate = require( 'json-gate' );
const dbFactory = require( './database.js' );


// Opts schema
const optsTest = jsongate.createSchema( {
	type: 'object',
	properties: {
		file: { type: 'string', required: true },
		create: { type: 'boolean', default: true },
		accuracy: { type: 'integer', default: 2, minimum: 0, maximum: 7 }
	},
	additionalProperties: false
} );


// Accounting class
function Accounting( opts ) {

	// Process opts
	optsTest.validate( opts );
	opts.appidMajor = 0x13370000;
	opts.appidMinor = opts.accuracy;
	opts.appidMinorBits = 3;
	opts.schema = require( './schema.js' );
	delete opts.accuracy;

	// Connect to database
	this._db = dbFactory( opts );

	// If connection to database has been established, read back accuracy.
	// It might be different from the stated one if the database has been
	// inititalised with a different accuracy.
	this._db.then( (db) => {
		this.accuracy = db.appidMinor;
		this._accuracy = Math.pow( 10, db.appidMinor );
		this._maxint = Number.MAX_SAFE_INTEGER / this._accuracy;
	} );

}

// Load class methods from directory
const REjs = /^(.*)\.js$/;
fs.readdirSync( './lib/accounting' ).forEach( (file) => {
	let tmp = REjs.exec( file );
	if( ! tmp ) return;

	const methodName = tmp[1];
	const method = require( './accounting/' + file );

	Accounting.prototype[ methodName ] = function() {

		// Convert aguments to array
		let args = Array.prototype.slice.call( arguments );

		// Get database instance and then call the method with
		// db instance followed by arguments that may have been specified
		return this._db.then( ( db ) => {
			return method.apply( this, [ db ].concat( args ) );
		} );

	};

} );

module.exports = Accounting;
