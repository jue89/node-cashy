'use strict';

const Cashy = require( '../../index.js' );
const Table = require( '../lib/table.js' );
const format = require( '../lib/format.js' );


// Output table
const out = new Table( process.stdout );


module.exports = (program) => program
	.command( 'list [account]' )
	.option( '-a, --after <date>', "list transactions after this date" )
	.option( '-b, --before <date>', "list transactions before this date" )
	.option( '--csv', "output comma-separated account list" )
	.description( "list transactions" )
	.action( list );

function list( account, opts ) {

	let filter = {};
	if( typeof opts.after == 'string' ) {
		filter.after = new Date( opts.after );
	}
	if( typeof opts.before == 'string' ) {
		filter.before = new Date( opts.before );
	}
	if( account ) {
		filter.account = account;
	}

	let cashy = Cashy( {
		create: false,
		file: opts.parent.file
	} );

	cashy.getTransactions( filter ).then( (transactions) => {

		if( account && account.indexOf( '*' ) === -1 ) {
			listOne( transactions );
		} else {
			listAll( transactions );
		}

	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

	function listOne( transactions ) {
		if( opts.csv ) {

			for( let t of transactions ) {
				console.log( `${t.id},${t.date},${t.reason},${t.flow[account]}` );
			}

		} else {

			// Heading
			out.write( "#", { pos: 6, align: 'right' } );
			out.write( "Date", { pos: 8 } );
			out.write( "Reason", { pos: 25 } );
			out.write( "Uncommitted?", { pos: -15, align: 'right' } );
			out.write( "Amount", { pos: -1, align: 'right' } );
			out.nl();
			out.line( 'blackBright' );
			// Body
			for( let t of transactions ) {
				out.write( t.id, { pos: 6, align: 'right' } );
				out.write( t.date.toDateString(), { pos: 8 } );
				out.write( t.reason, { pos: 25 } );
				if( ! t.commited ) out.write( '*', { pos: -15, align: 'right' } );
				out.write( format( t.flow[account], cashy.accuracy ), {
					pos: -1,
					align: 'right',
					color: (t.flow[account] >= 0) ? 'green' : 'red'
				} );
				out.nl();
			}

		}
	}

	function listAll( transactions ) {
		if( opts.csv ) {

			for( let t of transactions ) for( let account in t.flow ) {
				console.log( `${t.id},${t.date},${t.reason},${t.commited},${account},${t.flow[account]}` );
			}

		} else {

			// Heading
			out.write( "#", { pos: 6, align: 'right' } );
			out.write( "Date", { pos: 8 } );
			out.write( "Reason", { pos: 25 } );
			out.write( "Uncommitted?", { pos: -1, align: 'right' } );
			out.nl();
			out.write( "Account", { pos: 25 } );
			out.write( "Amount", { pos: -1, align: 'right' } );
			out.nl();
			out.line( 'blackBright' );
			// Body
			for( let t of transactions ) {
				out.write( t.id, { pos: 6, align: 'right' } );
				out.write( t.date.toDateString(), { pos: 8 } );
				out.write( t.reason, { pos: 25 } );
				if( ! t.commited ) out.write( '*', { pos: -1, align: 'right' } );
				out.nl();
				for( let account in t.flow ) {
					out.write( account, { pos: 25, color: 'blackBright' } );
					out.write( format( t.flow[account], cashy.accuracy ), {
						pos: -1,
						align: 'right',
						color: (t.flow[account] >= 0) ? 'green' : 'red'
					} );
					out.nl();
				}
			}

		}
	}

}
