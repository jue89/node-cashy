'use strict';

const Cashy = require( '../../index.js' );

module.exports = (program) => program
	.command( 'listAccounts' )
	.option( '-o --open <date>', "just list accounts open at this date" )
	.description( "list all accounts" )
	.action( createAccount );

function createAccount( opts ) {

	let filter = {};
	if( typeof opts.open == 'string' ) {
		filter.date = (opts.open == 'now') ? new Date() : new Date( opts.open );
	}

	Cashy( {
		create: false,
		file: opts.parent.file
	} ).getAccounts( filter ).then( (accounts) => {
		for( let a of accounts ) {
			if( a.description ) console.log( `${a.id}   (${a.description})` );
			else console.log( a.id );
		}
	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
