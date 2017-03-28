'use strict';

const assert = require( 'assert' );
const fs = require( 'fs' );
const q = require( './helper/q-assert.js' );

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
		q.shouldResolve(
			dbFactory( ':memory:' ).then( ( db ) => {
				return db.get( 'PRAGMA application_id;' );
			} ),
			( row ) => assert.strictEqual( row.application_id, 0x1337beef ),
			done
		);
	} );

	it( "should reject existing databases with wrong app id and tables inside", ( done ) => {
		const DB = require( '../lib/sqlite.js' );
		const db = new DB( `${tmpdir}/nonempty.sqlite` );
		q.shouldReject(
			db.run( 'CREATE TABLE test(val);' ).then( ( ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/nonempty.sqlite` );
			} ),
			"^Not a valid database: Wrong application ID.$",
			done
		);
	} );

	it( "should complain about wrong schema type", ( done ) => {
		q.shouldReject(
			dbFactory( ':memory:', true ),
			"boolean.*array",
			done
		);
	} );

	it( "should init an empty database with a schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( ':memory:', [ schema.v1 ] ).then( ( db ) => {
				return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
			} ),
			( row ) => assert.strictEqual( row.tblcnt, 2 ),
			done
		);
	} );

	it( "should not init an initialised database", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `${tmpdir}/initialised.sqlite`, [ schema.v1 ] ).then( ( db ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/initialised.sqlite`, [ schema.v1 ] );
			} ).then( ( db ) => {
				return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
			} ),
			( row ) => assert.strictEqual( row.tblcnt, 2 ),
			done
		);
	} );

	it( "should update a database schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `${tmpdir}/db-v1-v2.sqlite`, [ schema.v1 ] ).then( ( db ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/db-v1-v2.sqlite`, [ schema.v1, schema.v2 ] );
			} ).then( (db ) => {
				return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
			} ),
			( row ) => assert.strictEqual( row.tblcnt, 3 ),
			done
		);
	} );

	it( "should not open / update a database if schema update failed", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldReject(
			dbFactory( `${tmpdir}/db-v1fail-v2.sqlite`, [ schema.v1fail ] ).catch( () => {
				return dbFactory( `${tmpdir}/db-v1fail-v2.sqlite`, [ schema.v1, schema.v2 ] );
			} ),
			"^Database is an unsafe state. Last update failed!$",
			done
		);
	} );

	it( "should update a database schema two versions at once", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `${tmpdir}/db-v1-v3.sqlite`, [ schema.v1 ] ).then( ( db ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/db-v1-v3.sqlite`, [ schema.v1, schema.v2, schema.v3 ] );
			} ).then( (db ) => {
				return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
			} ),
			( row ) => assert.strictEqual( row.tblcnt, 4 ),
			done
		);
	} );

	it( "should update a database to the latest version", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `${tmpdir}/db-v2-v3.sqlite`, [ schema.v1, schema.v2 ] ).then( ( db ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/db-v2-v3.sqlite`, [ schema.v1, schema.v2, schema.v3 ] );
			} ).then( (db ) => {
				return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
			} ),
			( row ) => assert.strictEqual( row.tblcnt, 4 ),
			done
		);
	} );

	it( "should complain about unknown schema version", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldReject(
			dbFactory( `${tmpdir}/db-v3-v2.sqlite`, [ schema.v1, schema.v2, schema.v3 ] ).then( ( db ) => {
				return db.close();
			} ).then( () => {
				return dbFactory( `${tmpdir}/db-v3-v2.sqlite`, [ schema.v1, schema.v2 ] );
			} ),
			"^Schema format from future: Update tool to the latest version.$",
			done
		);
	} );

	it( "should reject inserts with unknown foreign key", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldReject(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'INSERT INTO child (id, parent) VALUES (1, 43);' ) );
			} ),
			"FOREIGN KEY constraint failed",
			done
		);
	} );

	it( "should instert row with foreign key", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) );
			} ),
			() => {},
			done
		);
	} );

	it( "should reject deletes if foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldReject(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) )
					.then( () => db.run( 'DELETE FROM parent WHERE id=42;' ) );
			} ),
			"FOREIGN KEY constraint failed",
			done
		);
	} );

	it( "should delete if no foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'DELETE FROM parent WHERE id=42;' ) );
			} ),
			() => {},
			done
		);
	} );

	it( "should reject updates if foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldReject(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) )
					.then( () => db.run( 'UPDATE parent SET id=41 WHERE id=42;' ) );
			} ),
			"FOREIGN KEY constraint failed",
			done
		);
	} );

	it( "should update if no foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		q.shouldResolve(
			dbFactory( `:memory:`, [ schema.foreign_key ] ).then( ( db ) => {
				return db.run( 'INSERT INTO parent (id) VALUES (42);' )
					.then( () => db.run( 'UPDATE parent SET id=41 WHERE id=42;' ) );
			} ),
			() => {},
			done
		);
	} );

	it( "should compare strings case-sensitive", ( done ) => {
		q.shouldResolve(
			dbFactory( `:memory:`, [] ).then( ( db ) => {
				return db.get( 'SELECT \'a\' LIKE \'A\' AS compare;' );
			} ),
			( result ) => assert.strictEqual( result.compare, 0 ),
			done
		);
	} );

} );
