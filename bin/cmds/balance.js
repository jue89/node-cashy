'use strict';

const Cashy = require( '../../index.js' );
const Table = require( '../lib/table.js' );
const format = require( '../lib/format.js' );


// Output table
const out = new Table( process.stdout );


module.exports = (program) => program
	.command( 'balance' )
	.option( '-d --date <date>', "balances at this date" )
	.option( '--csv', "output comma-separated account list" )
	.description( "list all accounts including their balances" )
	.action( balance );

function balance( opts ) {

	let filter = {};
	if( typeof opts.date == 'string' ) {
		filter.date = (opts.date == 'now') ? new Date() : new Date( opts.date );
	}

	let cashy = Cashy( {
		create: false,
		file: opts.parent.file
	} );

	cashy.getAccounts( filter ).then( (accounts) => {

		let jobs = [];
		for( let a of accounts ) jobs.push( a.balance( filter ) );
		return Promise.all( jobs ).then( (balances) => [accounts,balances] );

	} ).then( (args) => {

		const accounts = args[0];
		const balances = args[1];

		if( opts.csv ) {

			for( let a in accounts ) {
				console.log( `${accounts[a].id},${balances[a]}` );
			}

		} else {

			// Heading
			out.write( "Account", { pos: 1 } );
			out.write( "Balance", { pos: -1, align: 'right' } );
			out.nl();
			out.line( 'blackBright' );
			// Body
			for( let a in accounts ) {
				let path = accounts[a].id.split( '/' );
				let pos = 1 + 2 * ( path.length - 1 );
				let caption = path.pop();
				out.write( caption, {
					pos: pos,
					color: accounts[a].dateClosed ? 'blackBright' : 'white'
				} );
				out.write( format( balances[a], cashy.accuracy ), {
					pos: -1,
					align: 'right',
					color: (accounts[a].dateClosed) ? 'blackBright' : (balances[a] >= 0) ? 'green' : 'red'
				} );
				out.nl();
			}

		}

	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
