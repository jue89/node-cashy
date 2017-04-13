'use strict';

const jsongate = require( 'json-gate' );
const clc = require('cli-color');

function Table( outStream ) {
	this._out = outStream;
	this._width = outStream.isTTY ? outStream.columns : 80;
	this._x = 0;
}

Table.prototype.line = function( color ) {
	if( ! color ) color = 'white';
	this.write( '-'.repeat( this._width ),{ color: color } );
	this.nl();
};

Table.prototype.write = function( str, opts ) {

	// Parse options
	if( opts === undefined ) opts = {};
	jsongate.createSchema( { type: 'object', properties: {
		pos: { type: 'integer', minimum: -this._width, maximum: this._width, default: 0 },
		align: { type: 'string', enum: ['left','right'], default: 'left' },
		color: { type: 'string', enum: [
			'black',
			'red',
			'green',
			'yellow',
			'blue',
			'magenta',
			'cyan',
			'white',
			'blackBright',
			'redBright',
			'greenBright',
			'yellowBright',
			'blueBright',
			'magentaBright',
			'cyanBright',
			'whiteBright'
		] }
	} } ).validate( opts );

	// Create string
	str = str.toString();
	str = ( opts.color ) ? clc[opts.color]( str ) : str;
	let len = clc.getStrippedLength( str );

	// Move cursor
	if( opts.align == 'right' ) opts.pos -= len;
	if( opts.pos < 0 ) opts.pos += this._width;
	let diff = opts.pos - this._x;
	this._x += diff;
	if( diff < 0 ) {
		this._out.write( clc.move.left( diff ) );
	} else {
		this._out.write( clc.move.right( diff ) );
	}

	// Print field
	this._out.write( str );
	this._x += len;

};

Table.prototype.nl = function() {
	this._out.write( '\n' );
	this._x = 0;
};

module.exports = Table;
