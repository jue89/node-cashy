'use strict';

const sqlite3 = require( 'sqlite3' );
const Semaphore = require( './semaphore.js' );


// Class for DB connections
function SQLite( file, mode, callback ) {

	this._db = new sqlite3.Database( file, mode, callback );

	// Used for transactions
	this._sem = new Semaphore( 1 );

}

// Async proxy methods
[ 'get', 'all', 'run', 'close' ].forEach( ( func ) => {

	SQLite.prototype[ func ] = function() {

		// Convert aguments to array
		let args = Array.prototype.slice.call( arguments );

		// Take semaphore and then execute sqlite command
		return this._sem.take().then( () => new Promise( ( resolve, reject ) => {

			// Add callback
			args.push( ( err, row ) => {
				// We are finishe here -> Leave semaphore
				this._sem.leave();
				if( err ) return reject( err );
				resolve( row );
			} );

			// Call function of sqlite3 lib
			this._db[ func ].apply( this._db, args );

		} ) );

	};

} );


// Class for transactions (i.e. semaphore is dedicated to this transaction)
function SQLiteTransaction( db ) {
	this._db = db;
}

// Async proxy methods for transactions
[ 'get', 'all', 'run' ].forEach( ( func ) => {

	SQLiteTransaction.prototype[ func ] = function() {

		// Convert aguments to array
		let args = Array.prototype.slice.call( arguments );

		// Take semaphore and then execute sqlite command
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


// Add transaction method to SQLite class
SQLite.prototype.transaction = function( exec ) {

	// Fetch semaphore
	return this._sem.take().then( () => {

		// Create commands made available to transaction
		let transaction = new SQLiteTransaction( this._db );

		// At this point, all other processes except from us are blocked on the
		// database -> Start our transaction
		return transaction.run( "BEGIN;" )
			.then( () => exec( transaction ) )
			.then( (ret) => transaction.run( "COMMIT;" ).then( () => [ null, ret ] ) )
			.catch( (err) => transaction.run( "ROLLBACK;" ).then( () => [ err ] ) )
			.then( (args) => {
				// This point is always reached.
				this._sem.leave();
				// If args[0] isn't null an error occured
				if( args[0] !== null ) return Promise.reject( args[0] );
				else return Promise.resolve( args[1] );
			} );

	} );

};

// Add constants
[ 'OPEN_READONLY', 'OPEN_READWRITE', 'OPEN_CREATE' ].forEach( (c) => {
	SQLite[c] = sqlite3[c];
} );

module.exports = SQLite;
