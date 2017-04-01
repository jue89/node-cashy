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
		this.accuracy = Math.pow( 10, opts.accuracy );
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

			// Check given dataset
			jsongate.createSchema( { type: 'object', properties: {
				id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/]*$' },
				dateOpened: { type: 'string', format: 'date-time', default: new Date().toISOString() },
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

			return db.run( 'INSERT INTO accounts (id,dateOpened,description,data) VALUES (?,?,?,?);', [
				data.id,
				data.dateOpened,
				data.description,
				JSON.stringify(data.data)
			] );

		} );
	}

	getAccounts( opts ) {
		return this._db.then( ( db ) => {

			// Check options
			if( opts === undefined ) opts = {};
			if( opts.date instanceof Date ) opts.date = opts.date.toISOString();
			jsongate.createSchema( { type: 'object', default: {}, properties: {
				id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/\*]*$' },
				date: { type: 'string', format: 'date-time' }
			} } ).validate( opts );

			let where = [];
			let args = [];
			if( opts.date ) {
				where.push( 'dateOpened<=? AND (dateClosed IS NULL OR dateClosed>?)' );
				args.push( opts.date, opts.date );
			}
			if( opts.id ) {
				where.push( 'id GLOB ?' );
				args.push( opts.id );
			}

			return db.all( `SELECT * FROM accounts${where.length ? ' WHERE ' + where.join(' OR ') : ''} ORDER BY id;`, args );

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

	addTransaction( data, flows ) {
		let db; // TODO: Nasty hack. Don't try this at home.
		return this._db.then( ( _db ) => { db = _db;

			// Convert dates to strings
			if( data.date instanceof Date ) data.date = data.date.toISOString();

			// Check given dataset
			jsongate.createSchema( { type: 'object', properties: {
				date: { type: 'string', format: 'date-time', default: new Date().toISOString() },
				reason: { type: 'string', required: true },
				data: { type: 'object' }
			} } ).validate( data );
			jsongate.createSchema( { type: 'object', additionalProperties: false, patternProperties: {
				'^[0-9a-zA-Z/]*$': { type: 'number' }
			} }).validate( flows );
			if( Object.keys( flows ).length === 0 ) return Promise.reject(
				new Error( "At least two accounts must be involved in a transaction" )
			);

			// Check if all involved accounts are open
			let where = [];
			let args = [];
			for( let account in flows ) {
				where.push( 'id=? AND dateOpened>?' );
				args.push( account, data.date );
			}
			return db.all( `SELECT id FROM accounts WHERE ${where.join(' OR ')};`, args );

		} ).then( ( rows ) => {

			if( rows.length !== 0 ) {
				for( let r in rows ) rows[r] = rows[r].id;
				return Promise.reject(
					new Error( `${rows.join(' and ')} is not open on the date of the transaction` )
				);
			}

			// Create transaction
			return db.transaction( ( db ) => db.run(
				'INSERT INTO transactions (date,reason,data) VALUES (?,?,?)',
				[ data.date, data.reason, JSON.stringify(data.data) ]
			).then( () => db.get( 'SELECT last_insert_rowid() as id;' ) ).then( ( res ) => {
				let jobs = [];
				let sum = 0;

				for( let account in flows ) {
					let value = Math.round(flows[account] * this.accuracy);
					sum += value;
					jobs.push( db.run(
						'INSERT INTO flows (transaction_id,account_id,value) VALUES (?,?,?);',
						[ res.id, account, value ]
					) );
				}

				// If the sum does not equal zero, wait for all jobs to be finshed
				// and then rollback the whole transaction.
				if( sum !== 0 ) return Promise.all( jobs ).then( () => Promise.reject(
					new Error( "Sum of all values must be equal zero" )
				) );

				return Promise.all( jobs );
			} ) );

		} );
	}

}

module.exports = Accounting;
