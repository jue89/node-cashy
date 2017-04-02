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
			( rows ) => assert.deepEqual( rows, [ {
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
			( rows ) => assert.deepEqual( rows, [ {
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
			( rows ) => assert.deepEqual( rows, [
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
			} ).then( () => a.getAccounts() ),
			( accounts ) => assert.deepEqual( accounts, [ {
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
			] ).then( () => a.getAccounts( { date: new Date( 300 )} ) ),
			( accounts ) => assert.deepEqual( accounts, [ {
				id: 'open',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "",
				data: null
			} ] ),
			done
		);
	} );

	it( "should get account by id", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			Promise.all( [
				a.createAccount( { id: 'test', dateOpened: new Date( 100 ) } ),
				a.createAccount( { id: 'test2', dateOpened: new Date( 100 ) } )
			] ).then( () => a.getAccounts( { id: 'test' } ) ),
			( accounts ) => assert.deepEqual( accounts, [ {
				id: 'test',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "",
				data: null
			} ] ),
			done
		);
	} );

	it( "should list accounts with matching id", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		q.shouldResolve(
			Promise.all( [
				a.createAccount( { id: 'test', dateOpened: new Date( 100 ) } ),
				a.createAccount( { id: 'nope', dateOpened: new Date( 100 ) } )
			] ).then( () => Promise.all( [
				a.createAccount( { id: 'test/sub', dateOpened: new Date( 100 ) } )
			] ) ).then( () => a.getAccounts( { id: 'test*' } ) ),
			( accounts ) => assert.deepEqual( accounts, [ {
				id: 'test',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "",
				data: null
			}, {
				id: 'test/sub',
				dateOpened: new Date( 100 ),
				dateClosed: null,
				description: "",
				data: null
			} ] ),
			done
		);
	} );

	it( "should create a new transaction", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1' } ),
			a.createAccount( { id: 'test2' } )
		] ).then( () => a.addTransaction( { reason: 'Test' }, {
			test1: 1,
			test2: -1
		} ) ).then( () => a._db ).then( (db) => db.get(
			'SELECT COUNT(*) AS cnt FROM flows JOIN transactions;'
		) );
		q.shouldResolve( test, ( rows ) => assert.strictEqual( rows.cnt, 2 ), done );
	} );

	it( "should reject transactions without given reason", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1' } ),
			a.createAccount( { id: 'test2' } )
		] ).then( () => a.addTransaction( {}, {
			test1: 1,
			test2: -1
		} ) );
		q.shouldReject( test, "reason.*required", done );
	} );

	it( "should reject transactions without any accounts involved", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1' } ),
			a.createAccount( { id: 'test2' } )
		] ).then( () => a.addTransaction( { reason: 'test' }, {} ) );
		q.shouldReject( test, "At least two accounts must be involved in a transaction", done );
	} );

	it( "should reject transactions with sum of values != 0", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1' } ),
			a.createAccount( { id: 'test2' } )
		] ).then( () => a.addTransaction( { reason: 'test' }, {
			test1: 1,
			test2: -2
		} ) );
		q.shouldReject( test, "Sum of all values must be equal zero", done );
	} );

	it( "should reject transaction if one of the involved accounts is not open at transaction's date", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 300 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 100 ) } )
			// TODO: Close test2
		] ).then( () => a.addTransaction( { reason: 'test', date: new Date( 200 ) }, {
			test1: 1,
			test2: -1
		} ) );
		q.shouldReject( test, "test1 is not open on the date of the transaction", done );
	} );

	it( "should round value to stated accuracy", ( done ) => {
		let a = new Accounting( { file: ':memory:', accuracy: 4 } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1' } ),
			a.createAccount( { id: 'test2' } )
		] ).then( () => a.addTransaction( { reason: 'Test' }, {
			test1: 1,
			test2: -1
		} ) ).then( () => a._db ).then( (db) => db.all(
			'SELECT account_id,value FROM flows JOIN transactions ORDER BY account_id;'
		) );
		q.shouldResolve( test, ( rows ) => assert.deepEqual( rows, [
			{ account_id: 'test1', value: 10000 },
			{ account_id: 'test2', value: -10000 }
		] ), done );
	} );

	it( "should fetch transactions", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test3', dateOpened: new Date( 0 ) } ),
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test2: 2, test3: -2 } )
		] ) ).then( () => a.getTransactions() );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 2, reason: 'Test', commited: false, date: new Date( 200 ), data: null, flow: { test2: 2, test3: -2 } },
			{ _id: 1, reason: 'Test', commited: false, date: new Date( 100 ), data: null, flow: { test1: 1, test2: -1 } }
		] ), done );
	} );

	it( "should fetch transactions from a stated account", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test3', dateOpened: new Date( 0 ) } ),
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test2: 2, test3: -2 } )
		] ) ).then( () => a.getTransactions( { account: 'test3' } ) );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 2, reason: 'Test', commited: false, date: new Date( 200 ), data: null, flow: { test2: 2, test3: -2 } }
		] ), done );
	} );

	it( "should fetch transactions after a certain date", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test3', dateOpened: new Date( 0 ) } ),
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test2: 2, test3: -2 } )
		] ) ).then( () => a.getTransactions( { after: new Date( 100 ) } ) );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 2, reason: 'Test', commited: false, date: new Date( 200 ), data: null, flow: { test2: 2, test3: -2 } }
		] ), done );
	} );

	it( "should fetch transactions before a certain date", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test3', dateOpened: new Date( 0 ) } ),
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test2: 2, test3: -2 } )
		] ) ).then( () => a.getTransactions( { before: new Date( 200 ) } ) );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 1, reason: 'Test', commited: false, date: new Date( 100 ), data: null, flow: { test1: 1, test2: -1 } }
		] ), done );
	} );

	it( "should fetch transactions within a time window", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test3', dateOpened: new Date( 0 ) } ),
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test2: 2, test3: -2 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 300 ) }, { test2: 2, test3: -2 } )
		] ) ).then( () => a.getTransactions( { before: new Date( 300 ), after: new Date( 100 ) } ) );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 2, reason: 'Test', commited: false, date: new Date( 200 ), data: null, flow: { test2: 2, test3: -2 } }
		] ), done );
	} );

	it( "should commit transactions", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } )
		] ) ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].commit();
		} ).then( () => a.getTransactions() );
		q.shouldResolve( test, ( t ) => assert.deepEqual( t, [
			{ _id: 1, reason: 'Test', commited: true, date: new Date( 100 ), data: null, flow: { test1: 1, test2: -1 } }
		] ), done );
	} );

	it( "should reject commiting commited transactions", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } )
		] ) ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].commit();
		} ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].commit();
		} );
		q.shouldReject( test, "Transaction already has been commited", done );
	} );

	it( "should delete transactions", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } )
		] ) ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].delete();
		} ).then( () => a.getTransactions() );
		q.shouldResolve( test, ( t ) => assert.strictEqual( t.length, 0 ), done );
	} );

	it( "should reject deleting commited transactions", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } )
		] ) ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].commit();
		} ).then( () => a.getTransactions() ).then( ( t ) => {
			return t[0].delete();
		} ).then( () => a.getTransactions() );
		q.shouldReject( test, "Deleting commited transactions is not allowed", done );
	} );

	it( "should get balance of an account", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test1: 2, test2: -2 } )
		] ) ).then( () => a.getAccounts( { id: 'test1' } ) ).then( ( a ) => {
			return a[0].balance();
		} );
		q.shouldResolve( test, ( b ) => assert.strictEqual( b, 3 ), done );
	} );

	it( "should get balance of an account including sub accounts", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test12', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.createAccount( { id: 'test1/sub', dateOpened: new Date( 0 ) } ),
		] ) ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test12: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { 'test1/sub': 2, test12: -2 } )
		] ) ).then( () => a.getAccounts( { id: 'test1' } ) ).then( ( a ) => {
			return a[0].balance();
		} );
		q.shouldResolve( test, ( b ) => assert.strictEqual( b, 3 ), done );
	} );

	it( "should get balance of an account at a certain date", ( done ) => {
		let a = new Accounting( { file: ':memory:' } );
		let test = Promise.all( [
			a.createAccount( { id: 'test1', dateOpened: new Date( 0 ) } ),
			a.createAccount( { id: 'test2', dateOpened: new Date( 0 ) } )
		] ).then( () => Promise.all( [
			a.addTransaction( { reason: 'Test', date: new Date( 100 ) }, { test1: 1, test2: -1 } ),
			a.addTransaction( { reason: 'Test', date: new Date( 200 ) }, { test1: 2, test2: -2 } )
		] ) ).then( () => a.getAccounts( { id: 'test1' } ) ).then( ( a ) => {
			return a[0].balance( { date: new Date( 100 ) } );
		} );
		q.shouldResolve( test, ( b ) => assert.strictEqual( b, 1 ), done );
	} );

	// should close account
	// should reject closing an account of balance != 0
	// should reject closing an account has non-commited transactions
	// should reject closing an account if transactions occured after closing date
	// should reject closing an account if sub accounts are not closed
	// should delete account
	// should reject deleting an account if any transactions are present
	// should reject deleting an account if sub accounts are present

} );
