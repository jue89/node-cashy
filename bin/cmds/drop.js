'use strict';

const Cashy = require( '../../index.js' );

module.exports = (program) => program
	.command( 'drop [ids]' )
	.description( "remove transaction" )
	.action( add );

function add( id, opts ) {

	// Get all uncommited commits
	Cashy( {
		create: false,
		file: opts.parent.file
	} ).getTransactions( { id: parseInt(id) } ).then( (transactions) => {
		if( transactions.length === 0 ) return Promise.reject(
			new Error( "Unkown transaction id" )
		);
		return transactions[0].delete();
	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
