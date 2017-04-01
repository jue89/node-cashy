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

	createAccount( data ) {
		let db; // TODO: Nasty hack. Don't try this at home.
		return this._db.then( ( _db ) => { db = _db;

			// Convert dates to strings
			if( data.dateOpened instanceof Date ) data.dateOpened = data.dateOpened.toISOString();
			if( data.dateClosed instanceof Date ) data.dateClosed = data.dateClosed.toISOString();

			// Check given dataset
			jsongate.createSchema( { type: 'object', properties: {
				id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/]*$' },
				dateOpened: { type: 'string', format: 'date-time', default: new Date().toISOString() },
				dateClosed: { type: 'string', format: 'date-time' },
				description: { type: 'string', default: "" },
				data: { type: 'object' }
			} } ).validate( data );

			// Is root account? -> Skip parent check
			if( data.id.indexOf( '/' ) == -1 ) return { cnt: 1 };

			return db.get(
				'SELECT COUNT(*) AS cnt FROM accounts WHERE id=?',
				data.id.substr(0,data.id.indexOf('/'))
			);

		} ).then( ( res ) => {

			if( res.cnt !== 1 ) return Promise.reject(
				new Error( `Parent account '${data.id.substr(0,data.id.indexOf('/'))}' is missing` )
			);

			return db.run( 'INSERT INTO accounts (id,dateOpened,dateClosed,description,data) VALUES (?,?,?,?,?);', [
				data.id,
				data.dateOpened,
				data.dateClosed,
				data.description,
				JSON.stringify(data.data)
			] );

	} ); }

	listAccounts( opts ) {
		return this._db.then( ( db ) => {

			// Check options
			if( opts === undefined ) opts = {};
			if( opts.date instanceof Date ) opts.date = opts.date.toISOString();
			jsongate.createSchema( { type: 'object', default: {}, properties: {
				date: { type: 'string', format: 'date-time' }
			} } ).validate( opts );

			if( opts.date ) return db.all(
				'SELECT * FROM accounts WHERE dateOpened<=? AND dateClosed IS NULL OR dateClosed>?;',
				[ opts.date, opts.date ]
			);

			return db.all( 'SELECT * FROM accounts;' );

		} ).then( ( rows ) => {

			// Convert strings back to objects
			for( let r in rows ) {
				if( typeof rows[r].data == 'string' ) rows[r].data = JSON.parse( rows[r].data );
				if( typeof rows[r].dateOpened == 'string' ) rows[r].dateOpened = new Date( rows[r].dateOpened );
				if( typeof rows[r].dateClosed == 'string' ) rows[r].dateClosed = new Date( rows[r].dateClosed );
			}

			return rows;

		} );
	}

}

module.exports = Accounting;
