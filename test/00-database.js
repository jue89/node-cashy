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

} );
