'use strict';

const assert = require( 'assert' );

function shouldResolve( action, assert, done ) {
	action.then( ( data ) => {
		assert( data );
		done();
	} ).catch( done );
}

function shouldReject( action, msg, done ) {
	const msgRE = new RegExp( msg );
	action.then( () => {
		done( new Error( "Is expected to fail" ) );
	} ).catch( ( e ) => {
		if( ! msgRE.test( e.message ) ) assert.fail( e.message, msg, undefined, '~' );
		done();
	} ).catch( done );
}

module.exports = { shouldResolve, shouldReject };
