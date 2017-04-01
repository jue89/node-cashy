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

	it( "should open a new account with minimal data", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			a.createAccount( { id: 'test' } )
				.then( () => a._db )
				.then( (db) => db.all( 'SELECT id, dateClosed, description, data FROM accounts;' ) ),
			( rows ) => assert.deepStrictEqual( rows, [ {
				id: 'test',
				dateClosed: null,
				description: "",
				data: null
			} ] ),
			done
		);
	} );

	it( "should open a new account with full data", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			a.createAccount( {
				id: 'test',
				dateOpened: new Date( 100 ),
				description: "Test",
				data: { test: true }
			} ).then( () => a._db ).then( (db) => db.all( 'SELECT * FROM accounts;' ) ),
			( rows ) => assert.deepStrictEqual( rows, [ {
				id: 'test',
				dateOpened: new Date( 100 ).toISOString(),
				dateClosed: null,
				description: "Test",
				data: '{"test":true}'
			} ] ),
			done
		);
	} );

	const failsCreation = {
		'ID too short': { id: '' },
		'ID too long': { id: 'a'.repeat( 129 ) },
		'ID contains invalid characters': { id: '$' }
	};
	for( let reason in failsCreation ) {
		it( "should reject account creation due to wrong paramters: " + reason, ( done ) => {
			let a = new Accounting( { file: ':memory:' } );
			q.shouldReject(
				a.createAccount( failsCreation[ reason ] ),
				'JSON object property',
				done
			);
		} );
	}

	it( "should open sub account", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			a.createAccount( { id: 'test' } )
				.then( () => a.createAccount( { id: 'test/A0' } ) )
				.then( () => a._db )
				.then( (db) => db.all( 'SELECT id FROM accounts;' ) ),
			( rows ) => assert.deepStrictEqual( rows, [
				{ id: 'test' },
				{ id: 'test/A0' }
			] ),
			done
		);
	} );

	it( "should reject sub account creation if parent account is not present", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldReject(
			a.createAccount( { id: 'test/A0' } ),
			"Parent account 'test' is missing",
			done
		);
	} );

	it( "should list accounts", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			a.createAccount( {
				id: 'test',
				dateOpened: new Date( 100 ),
				description: "Test",
				data: { test: true }
			} ).then( () => a.listAccounts() ),
			( accounts ) => assert.deepStrictEqual( accounts, [ {
				id: 'test',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "Test",
				data: { test: true }
			} ] ),
			done
		);
	} );

	it( "should list accounts at a specific date and ignore accounts opened later or closed earlier", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			Promise.all( [
				a.createAccount( { id: 'open', dateOpened: new Date( 100 ) } ),
				a.createAccount( { id: 'openedAfter', dateOpened: new Date( 400 ) } )
				// TODO: closed account is missing
			] ).then( () => a.listAccounts( { date: new Date( 300 )} ) ),
			( accounts ) => assert.deepStrictEqual( accounts, [ {
				id: 'open',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "",
				data: null
			} ] ),
			done
		);
	} );

	// should create a new transaction
	// should reject transactions without given reason
	// should reject transactions without any accounts involved
	// should reject transactions with sum of values != 0
	// should reject transaction if one of the involved accounts is closed
	// should round value to configured accuracy
	// should commit transactions
	// should delete transactions
	// should reject deleting commited transactions

	// should get balance of an account

	// should close account
	// should reject closing an account of balance != 0
	// should reject closing an account is transactions occured after closing date
	// should delete account
	// should reject deleting an account if any transactions are present

} );
