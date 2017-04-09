'use strict';

const Cashy = require( '../../index.js' );

module.exports = (program) => program
	.command( 'add <account1:value> <account2:value> [account3:value...]' )
	.option( '-r --reason <reason>', "reason for the transaction" )
	.option( '-d --date <date>', "date of the transaction" )
	.description( "creates new transaction" )
	.action( add );

function add( act1, act2, actn, opts ) {

	// Parse given accounts
	actn.unshift( act2 );
	actn.unshift( act1 );
	let flowWithoutValue = null;
	let flows = {};
	let sum = 0;
	for( let a in actn ) {
		let flow = actn[a].split( ':' );

		// Flow without value
		if( flow.length == 1 ) {
			// Make sure only one account is without value
			if( flowWithoutValue !== null ) throw new Error("Value can be omitted at only one account");
			flowWithoutValue = flow[0];
			continue;
		}

		flows[flow[0]] = parseFloat( flow[1] );
		sum += parseFloat( flow[1] );

	}
	if( flowWithoutValue !== null ) {
		// Fill the account without value with
		flows[ flowWithoutValue ] = sum * (-1);
	}

	// Prepare transaction meta data
	let transaction = {};
	if( typeof opts.date == 'string' ) transaction.date = new Date( opts.date );
	if( typeof opts.reason == 'string' ) transaction.reason = opts.reason;

	Cashy( {
		create: false,
		file: opts.parent.file
	} ).addTransaction( transaction, flows ).then( (id) => {
		console.log( `Added transaction: ${id}` );
	} ).catch( ( e ) => {
		console.error( e.message );
		process.exit( 1 );
	} );

}
