'use strict';

const assert = require( 'assert' );

describe( "database", function() {

	const dbFactory = require( '../lib/database.js' );

	it( "should create new database", ( done ) => {
		dbFactory( ':memory:' ).then( ( db ) => {
			return db.get( 'PRAGMA application_id;' );
		} ).then( ( row ) => {
			assert.strictEqual( row.application_id, 0x1337beef );
			done();
		} ).catch( done );
	} );

} );
