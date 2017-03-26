'use strict';

const SQLite = require( './sqlite.js' );

const APPID = 0x1337beef;

module.exports = function( file ) {

	let db = new SQLite( file );

	// If database is empty (no tables + application_id == 0 + user_version == 0)
	// -> Init database
	return Promise.all( [
		db.get( 'PRAGMA application_id;' ),
		db.get( 'SELECT COUNT(*) as tblcnt FROM sqlite_master WHERE type=?;', 'table' )
	] ).then( ( res ) => {
		const appid = res[0].application_id;
		const tblcnt = res[1].tblcnt;

		// Set app id
		return db.run( `PRAGMA application_id=${APPID};` );

	} ).then( () => {
		return db;
	} );

};
