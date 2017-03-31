'use strict';

const assert = require( 'assert' );
const q = require( './helper/q-assert.js' );

describe( "accounting", function() {

	const Accounting = require( '../lib/accounting.js' );

	it( "should create new accounting database", ( done ) => {
		const SQLite = require( '../lib/sqlite.js' );
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			a._db,
			( db ) => assert.ok( db instanceof SQLite ),
			done
		);
	} );

	it( "should create new accounting database with specified accuracy", ( done ) => {
		let a = new Accounting( { file: ':memory:', accuracy: 1 } );
		q.shouldResolve(
			a._db.then( (db) => db.get( 'PRAGMA application_id;' ) ),
			( row ) => assert.strictEqual( row.application_id, 0x13370001 ),
			done
		);
	} );

	it( "should reject accounting database creation with accurany larger than 4", ( done ) => {
		assert.throws(
			() => new Accounting( { file: ':memory:', accuracy: 5 } ),
			/5.*4/
		);
		done();
	} );

	// should open new account
	// should reject account creation due to wrong paramters
	// should reject sub account creation if parent account is not present
	// should open sub account
	// should list accounts
	// should list accounts at a specific date and ignore accounts opened later or closed earlier

	// should create a new transaction
	// should reject transactions without given reason
	// should reject transactions without any accounts involved
	// should reject transactions with sum of values != 0
	// should round value to configured accuracy
	// should commit transactions
	// should delete transactions
	// should reject deleting commited transactions

	// should get balance of an account

	// should close account
	// should reject closing an account of balance != 0
	// should delete account
	// should reject deleting an account if any transactions are present

} );
