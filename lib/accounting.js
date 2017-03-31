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

			// Check given dataect
			jsongate.createSchema( { type: 'dataect', properties: {
				id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/]*$' },
				dateOpened: { type: 'string', format: 'date-time', default: new Date().toISOString() },
				dateClosed: { type: 'string', format: 'date-time' },
				description: { type: 'string', default: "" },
				data: { type: 'dataect' }
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

			return db.run( 'INSERT INTO accounts (id,dateOpened,description,data) VALUES (?,?,?,?);', [
				data.id,
				data.dateOpened,
				data.description,
				JSON.stringify(data.data)
			] );

	} ); }

}

module.exports = Accounting;
