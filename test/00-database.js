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
		let test = dbFactory( { file: ':memory:' } ).then( ( db ) => {
			return db.get( 'PRAGMA application_id;' );
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.application_id, 0x1337bee0 );
		}, done );
	} );

	it( "should reject database creation if not allowed", ( done ) => {
		let test = dbFactory( { file: `${tmpdir}/donotcreate.sqlite`, create: false } );
		q.shouldReject( test, "unable to open database file", done );
	} );

	it( "should reject non-string database paths", ( done ) => {
		let test = dbFactory( { file: true } );
		q.shouldReject( test, "boolean.*string", done );
	} );

	it( "should allow defining different major application ID", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMajor: 0x7fffffff
		} ).then( ( db ) => {
			return db.get( 'PRAGMA application_id;' );
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.application_id, 0x7fffffff )
		}, done );
	} );

	it( "should allow defining different minor application ID", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMinor: 0x1,
			appidMinorBits: 4
		} ).then( ( db ) => {
			return db.get( 'PRAGMA application_id;' );
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.application_id, 0x1337bee1 );
		}, done );
	} );

	it( "should reject too large major application IDs", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMajor: 0x7fffffff + 1
		} );
		q.shouldReject( test, "2147483648.*2147483647", done );
	} );

	it( "should reject too large minor application IDs", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMinor: 0x7fffffff + 1
		} );
		q.shouldReject( test, "2147483648.*2147483647", done );
	} );

	it( "should complain about wrong major application ID type", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMajor: true
		} );
		q.shouldReject( test, "boolean.*integer", done );
	} );

	it( "should complain about wrong minor application ID type", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			appidMinor: true
		} );
		q.shouldReject( test, "boolean.*integer", done );
	} );

	it( "should open database with matching major and minor application ID", ( done ) => {
		let test = dbFactory( {
			file: `${tmpdir}/same-minor-id.sqlite`,
			appidMajor: 0x13370000,
			appidMinor: 0xa,
			appidMinorBits: 4,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ).then( (db) => db.close() ).then( () => dbFactory( {
			file: `${tmpdir}/same-minor-id.sqlite`,
			appidMajor: 0x13370000,
			appidMinor: 0xa,
			appidMinorBits: 4,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ) ).then( (db) => db.appidMinor );
		q.shouldResolve( test, (id) => {
			assert.strictEqual( id, 0xa );
		}, done );
	} );

	it( "should open database with matching major application ID and different minor ID", ( done ) => {
		let test = dbFactory( {
			file: `${tmpdir}/different-minor-id.sqlite`,
			appidMajor: 0x13370000,
			appidMinor: 0xa,
			appidMinorBits: 4,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ).then( (db) => db.close() ).then( () => dbFactory( {
			file: `${tmpdir}/different-minor-id.sqlite`,
			appidMajor: 0x13370000,
			appidMinor: 0xf,
			appidMinorBits: 4,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ) ).then( (db) => db.appidMinor );
		q.shouldResolve( test, (id) => {
			assert.strictEqual( id, 0xa );
		}, done );
	} );

	it( "should reject opening database with non-matching major application ID", ( done ) => {
		let test = dbFactory( {
			file: `${tmpdir}/wrong-major-id.sqlite`,
			appidMajor: 0x13370000,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ).then( (db) => db.close() ).then( () => dbFactory( {
			file: `${tmpdir}/wrong-major-id.sqlite`,
			appidMajor: 0x13380000,
			schema: [require( './data/00-database-schema.js' ).v1]
		} ) );
		q.shouldReject( test, "Not a valid database: Wrong application ID.", done );
	} );

	it( "should complain about wrong schema type", ( done ) => {
		let test = dbFactory( {
			file: ':memory:',
			schema: true
		} );
		q.shouldReject( test, "boolean.*array", done );
	} );

	it( "should init an empty database with a schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: ':memory:',
			schema: [ schema.v1 ]
		} ).then( ( db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' );
		} );
		q.shouldResolve( test, ( row ) => assert.strictEqual( row.tblcnt, 2 ), done );
	} );

	it( "should not init an initialised database", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `${tmpdir}/initialised.sqlite`,
			schema: [ schema.v1 ]
		} ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( { file: `${tmpdir}/initialised.sqlite`, schema: [ schema.v1 ] } );
		} ).then( ( db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.tblcnt, 2 );
		}, done );
	} );

	it( "should update a database schema", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `${tmpdir}/db-v1-v2.sqlite`,
			schema: [ schema.v1 ]
		} ).then( (db) => {
			return db.close();
		} ).then( () => dbFactory( {
			file: `${tmpdir}/db-v1-v2.sqlite`,
			schema: [ schema.v1, schema.v2 ]
		} ) ).then( (db) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.tblcnt, 3 );
		}, done );
	} );

	it( "should not open / update a database if schema update failed", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `${tmpdir}/db-v1fail-v2.sqlite`,
			schema: [ schema.v1fail ]
		} ).catch( () => dbFactory( {
			file: `${tmpdir}/db-v1fail-v2.sqlite`,
			schema: [ schema.v1, schema.v2 ]
		} ) );
		q.shouldReject( test, "^Database is an unsafe state. Last update failed!$", done );
	} );

	it( "should update a database schema two versions at once", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( { file: `${tmpdir}/db-v1-v3.sqlite`, schema: [ schema.v1 ] } ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( { file: `${tmpdir}/db-v1-v3.sqlite`, schema: [ schema.v1, schema.v2, schema.v3 ] } );
		} ).then( (db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.tblcnt, 4 );
		}, done );
	} );

	it( "should update a database to the latest version", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `${tmpdir}/db-v2-v3.sqlite`,
			schema: [ schema.v1, schema.v2 ]
		} ).then( ( db ) => {
			return db.close();
		} ).then( () => dbFactory( {
			file: `${tmpdir}/db-v2-v3.sqlite`,
			schema: [ schema.v1, schema.v2, schema.v3 ]
		} ) ).then( ( db ) => {
			return db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
		} );
		q.shouldResolve( test, ( row ) => {
			assert.strictEqual( row.tblcnt, 4 );
		}, done );
	} );

	it( "should complain about unknown schema version", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `${tmpdir}/db-v3-v2.sqlite`,
			schema: [ schema.v1, schema.v2, schema.v3 ]
		} ).then( ( db ) => {
			return db.close();
		} ).then( () => {
			return dbFactory( { file: `${tmpdir}/db-v3-v2.sqlite`, schema: [ schema.v1, schema.v2 ] } );
		} );
		q.shouldReject( test, "^Schema format from future: Update tool to the latest version.$", done );
	} );

	it( "should reject inserts with unknown foreign key", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( { file: `:memory:`, schema: [ schema.foreign_key ] } ).then( ( db ) => {
			return db.run( 'INSERT INTO parent (id) VALUES (42);' )
				.then( () => db.run( 'INSERT INTO child (id, parent) VALUES (1, 43);' ) );
		} );
		q.shouldReject( test, "FOREIGN KEY constraint failed", done );
	} );

	it( "should instert row with foreign key", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.foreign_key ]
		} ).then( ( db ) =>
			db.run( 'INSERT INTO parent (id) VALUES (42);' ).then( () =>
			db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) )
		);
		q.shouldResolve( test, () => {}, done );
	} );

	it( "should reject deletes if foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.foreign_key ]
		} ).then( ( db ) =>
			db.run( 'INSERT INTO parent (id) VALUES (42);' ).then( () =>
			db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) ).then( () =>
			db.run( 'DELETE FROM parent WHERE id=42;' ) )
		);
		q.shouldReject( test, "FOREIGN KEY constraint failed", done );
	} );

	it( "should delete if no foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.foreign_key ]
		} ).then( ( db ) =>
			db.run( 'INSERT INTO parent (id) VALUES (42);' ).then( () =>
			db.run( 'DELETE FROM parent WHERE id=42;' ) )
		);
		q.shouldResolve( test, () => {}, done );
	} );

	it( "should reject updates if foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.foreign_key ]
		} ).then( ( db ) =>
			db.run( 'INSERT INTO parent (id) VALUES (42);' ).then( () =>
			db.run( 'INSERT INTO child (id, parent) VALUES (1, 42);' ) ).then( () =>
			db.run( 'UPDATE parent SET id=41 WHERE id=42;' ) )
		);
		q.shouldReject( test, "FOREIGN KEY constraint failed", done );
	} );

	it( "should update if no foreign records are pointing this record", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		const test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.foreign_key ]
		} ).then( ( db ) =>
			db.run( 'INSERT INTO parent (id) VALUES (42);' ).then( () =>
			db.run( 'UPDATE parent SET id=41 WHERE id=42;' ) )
		);
		q.shouldResolve( test, () => {}, done );
	} );

	it( "should compare strings case-sensitive", ( done ) => {
		let test = dbFactory( { file: `:memory:` } ).then( ( db ) => {
			return db.get( 'SELECT \'a\' LIKE \'A\' AS compare;' );
		} );
		q.shouldResolve( test, ( result ) => {
			assert.strictEqual( result.compare, 0 );
		}, done );
	} );

	it( "should group statements in a transaction", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( {
			file: `:memory:`,
			schema: [ schema.v1 ]
		} ).then( ( db ) => {
			db.transaction( ( db ) => Promise.all( [
				db.run( 'INSERT INTO t1 (c11) VALUES (1);' ),
				db.run( 'INSERT INTO t1 (c11) VALUES (2);' )
			] ) );
			return db.run( 'INSERT INTO t1 (c11) VALUES (3);' )
				.then( () => db.all( 'SELECT * FROM t1 ORDER BY rowid;' ) )
		} );
		q.shouldResolve( test, ( rows ) => {
			assert.deepEqual( rows, [ { c11: 1 }, { c11: 2 }, { c11: 3 } ] );
		}, done );
	} );

	it( "should roll back a transaction", ( done ) => {
		const schema = require( './data/00-database-schema.js' );
		let test = dbFactory( { file: `:memory:`, schema: [ schema.v1 ] } ).then( ( db ) => {
			db.transaction( ( db ) => Promise.all( [
				db.run( 'INSERT INTO t1 (c11) VALUES (1);' ),
				db.run( 'INSERT INTO t1 (c11) VALUES (2);' )
			] ).then( () => Promise.reject() ) ).catch( () => {} );
			return db.run( 'INSERT INTO t1 (c11) VALUES (3);' )
				.then( () => db.all( 'SELECT * FROM t1 ORDER BY rowid;' ) )
		} );
		q.shouldResolve( test, ( rows ) => {
			assert.deepEqual( rows, [ { c11: 3 } ] );
		}, done );
	} );

} );
