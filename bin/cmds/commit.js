'use strict';

const Cashy = require( '../../index.js' );

module.exports = (program) => program
	.command( 'commit [ids...]' )
	.option( '-a --all', "commit all pending transactions" )
	.description( "commit transactions" )
	.action( add );

function add( ids, opts ) {

	// Get all uncommited commits
	Cashy( {
		create: false,
		file: opts.parent.file
	} ).getTransactions( { commited: false } ).then( (transactions) => {
		let jobs = [];
		for( let t of transactions ) {
			if( opts.all || ids.indexOf( t.id.toString() ) !== -1 ) jobs.push( t.commit() );
		}
		return Promise.all( jobs );
	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
