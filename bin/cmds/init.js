'use strict';

const Cashy = require( '../../index.js' );
const fs = require( 'fs' );

module.exports = (program) => program
	.command( 'init' )
	.option( '-a --accuracy <number>', "sets decimal precision for database", '2' )
	.description( "initialise database" )
	.action( init );

function init( opts ) {

	if( fs.existsSync( opts.parent.file ) ) throw new Error( "Database already exists" );

	Cashy( {
		create: true,
		file: opts.parent.file,
		accuracy: parseInt( opts.accuracy )
	} );

}
