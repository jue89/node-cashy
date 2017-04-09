'use strict';

const Cashy = require( '../../index.js' );
const Table = require( '../lib/table.js' );

// Output table
const out = new Table( process.stdout );

module.exports = (program) => program
	.command( 'listAccounts' )
	.option( '-o --open <date>', "just list accounts open at this date" )
	.option( '--csv', "output comma-separated account list" )
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

		if( opts.csv ) {

			for( let a of accounts ) {
				console.log( `${a.id},${a.description},${a.dateOpened},${a.dateClosed}` );
			}

		} else {

			out.write( "ID", { pos: 1 } );
			out.write( "Description", { pos: 30 } );
			out.write( "Date opened", { pos: -34 } );
			out.write( "Date closed", { pos: -17 } );
			out.nl();
			out.line( 'blackBright' );
			for( let a of accounts ) {
				let path = a.id.split( '/' );
				let pos = 1 + 2 * ( path.length - 1 );
				let caption = path.pop();
				out.write( caption, { pos: pos } );
				out.write( a.description, { pos: 30 } );
				out.write( a.dateOpened.toDateString(), { pos: -34 } );
				out.write( a.dateClosed ? a.dateClosed.toDateString() : '', { pos: -17 } );
				out.nl();
			}

		}

	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
