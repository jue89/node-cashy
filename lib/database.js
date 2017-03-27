'use strict';

const jsongate = require( 'json-gate' );
const SQLite = require( './sqlite.js' );

const APPID = 0x1337beef;


const schemaTest = jsongate.createSchema( {
	type: 'array',
	items: [ {
		type: 'object',
		properties: {
			'init': { required: true }
		},
		additionalProperties: false
	} ],
	additionalItems: {
		type: 'object',
		properties: {
			'init': { required: true },
			'update': { required: true }
		},
		additionalProperties: false
	}
} );


module.exports = function( file, schema ) {

	let db = new SQLite( file );

	// If database is empty (no tables + application_id == 0 + user_version == 0)
	// -> Init database
	return Promise.all( [
		db.get( 'PRAGMA application_id;' ),
		db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' ),
		db.get( 'PRAGMA user_version;' )
	] ).then( ( res ) => {

		const appid = res[0].application_id;
		const tblcnt = res[1].tblcnt;
		const schemaversion = res[2].user_version;

		// Appid is matching! Everything is fine
		if( appid === APPID ) return schemaversion;

		// Database is not emptry -> reject
		if( tblcnt !== 0 ) return Promise.reject( new Error( "Not a valid database" ) );

		// Set app id
		return db.run( `PRAGMA application_id=${APPID};` ).then( () => schemaversion );

	} ).then( ( schemaversion ) => {

		if( ! schema ) return;

		// If schema is defined apply it.
		schemaTest.validate( schema );
		return applySchema( schemaversion, schema );

		function applySchema( schemaversion, schema ) {
			if( schemaversion % 2 !== 0 ) {
				return Promise.reject( new Error( "Database is an unsafe state. Last update failed!" ) );
			} else if( schemaversion / 2 < schema.length ) {
				// Before running the migration code, increase the schema version.
				// This indicates that the database might be in an unsafe state.
				let i = schemaversion / 2;
				return db.run( `PRAGMA user_version=${++schemaversion};` ).then( () => {
					if( i === 0 ) return schema[0].init( db );
					return schema[i].update( db );
				} ).then( () => db.run( `PRAGMA user_version=${++schemaversion};` ) ).then( () => {
					// Recursively call apply schema if we haven't finised yet
					if( schemaversion / 2 < schema.length ) {
						return applySchema( schemaversion, schema );
					}
				} );
			}
		}

	} ).then( () => db );

};
