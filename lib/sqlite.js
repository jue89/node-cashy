'use strict';

const sqlite3 = require( 'sqlite3' );

function SQLite( file ) {
	this._db = new sqlite3.Database( file );
}

// Async proxy methods
[ 'get', 'run' ].forEach( ( func ) => {

	SQLite.prototype[ func ] = function() {

		// Convert aguments to array
		let args = Array.prototype.slice.call( arguments );

		return new Promise( ( resolve, reject ) => {

			// Add callback
			args.push( ( err, row ) => {
				if( err ) return reject( err );
				resolve( row );
			} );

			// Call function of sqlite3 lib
			this._db[ func ].apply( this._db, args );

		} );

	};

} );

module.exports = SQLite;
