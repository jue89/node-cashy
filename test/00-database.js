'use strict';

const assert = require( 'assert' );
const fs = require( 'fs' );

describe( "database", function() {

	const dbFactory = require( '../lib/database.js' );

	// Creates a tmp dir for local data
	let tmpdir;
	before( () => {
		tmpdir = fs.mkdtempSync( '/tmp/cashy-test-' );
	} );
	after( () => {
		deleteFolderRecursive( tmpdir );
		function deleteFolderRecursive( path ) {
			if( fs.existsSync( path ) ) {
				fs.readdirSync( path ).forEach( ( file, index ) => {
					const curPath = path + "/" + file;
					if( fs.lstatSync( curPath ).isDirectory() ) {
						deleteFolderRecursive( curPath );
					} else {
						fs.unlinkSync( curPath );
					}
				} );
				fs.rmdirSync(path);
			}
		};
	} );

	it( "should create new database", ( done ) => {
		dbFactory( ':memory:' ).then( ( db ) => {
			return db.get( 'PRAGMA application_id;' );
		} ).then( ( row ) => {
			assert.strictEqual( row.application_id, 0x1337beef );
			done();
		} ).catch( done );
	} );

	it( "should reject existing databases with wrong app id and tables inside", ( done ) => {
		const DB = require( '../lib/sqlite.js' );
		const db = new DB( `${tmpdir}/nonempty.sqlite` );
		db.run( 'CREATE TABLE test(val);' ).then( ( ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( `${tmpdir}/nonempty.sqlite` );
		} ).then( () => {
			done( new Error( "Did not throw an exception" ) );
		} ).catch( (e) => {
			assert.strictEqual( e.message, "Not a valid database" );
			done();
		} ).catch( done );
	} );

	it( "should complain about wrong schema type", ( done ) => {
		dbFactory( ':memory:', true ).then( () => {
			done( new Error( "Did not throw an exception" ) );
		} ).catch( () => done() );
	} );

	it( "should init an empty database with a schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( ':memory:', [ schema.v1 ] ).then( ( db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} ).then( ( row ) => {
			assert.strictEqual( row.tblcnt, 2 );
			done();
		} ).catch( done );
	} );

	it( "should not init an initialised database", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( `${tmpdir}/initialised.sqlite`, [ schema.v1 ] ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( `${tmpdir}/initialised.sqlite`, [ schema.v1 ] );
		} ).then( (db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} ).then( ( row ) => {
			assert.strictEqual( row.tblcnt, 2 );
			done();
		} ).catch( done );
	} );

	it( "should update a database schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( `${tmpdir}/db-v1-v2.sqlite`, [ schema.v1 ] ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( `${tmpdir}/db-v1-v2.sqlite`, [ schema.v1, schema.v2 ] );
		} ).then( (db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} ).then( ( row ) => {
			assert.strictEqual( row.tblcnt, 3 );
			done();
		} ).catch( done );
	} );

	it( "should not open / update a database if schema update failed", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( `${tmpdir}/db-v1fail-v2.sqlite`, [ schema.v1fail ] ).catch( () => {
			return dbFactory( `${tmpdir}/db-v1fail-v2.sqlite`, [ schema.v1, schema.v2 ] );
		} ).then( () => {
			done( new Error("Should throw an exception") );
		} ).catch( ( e ) => {
			assert.strictEqual( e.message, "Database is an unsafe state. Last update failed!" );
			done();
		} ).catch( done );
	} );

	it( "should update a database schema two versions at once", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( `${tmpdir}/db-v1-v3.sqlite`, [ schema.v1 ] ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( `${tmpdir}/db-v1-v3.sqlite`, [ schema.v1, schema.v2, schema.v3 ] );
		} ).then( (db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} ).then( ( row ) => {
			assert.strictEqual( row.tblcnt, 4 );
			done();
		} ).catch( done );
	} );

	it( "should update a database to the latest version", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		dbFactory( `${tmpdir}/db-v2-v3.sqlite`, [ schema.v1, schema.v2 ] ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( `${tmpdir}/db-v2-v3.sqlite`, [ schema.v1, schema.v2, schema.v3 ] );
		} ).then( (db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} ).then( ( row ) => {
			assert.strictEqual( row.tblcnt, 4 );
			done();
		} ).catch( done );
	} );

} );
