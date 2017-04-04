'use strict';

const jsongate = require( 'json-gate' );

module.exports = function( db, opts ) {

	// Factory: Prototype for transaction methods
	if( ! this._transactionPrototype ) {
		this._transactionPrototype = {};
		this._transactionPrototype.commit = function() {
			if( this.commited ) return Promise.reject(
				new Error( "Transaction already has been commited" )
			);
			return db.run( 'UPDATE transactions SET commited=1 WHERE id=? AND commited=0', this._id );
		};
		this._transactionPrototype.delete = function() {
			if( this.commited ) return Promise.reject(
				new Error( "Deleting commited transactions is not allowed" )
			);
			return db.transaction( (db) => Promise.all( [
				db.run( 'DELETE FROM flows WHERE transaction_id=?', this._id ),
				db.run( 'DELETE FROM transactions WHERE id=?', this._id )
			] ) );
		};
	}

	// Check options
	if( opts === undefined ) opts = {};
	if( opts.after instanceof Date ) opts.after = opts.after.toISOString();
	if( opts.before instanceof Date ) opts.before = opts.before.toISOString();
	jsongate.createSchema( { type: 'object', properties: {
		account: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/\*]*$' },
		after: { type: 'string', format: 'date-time' },
		before: { type: 'string', format: 'date-time' }
	} } ).validate( opts );

	let where = [];
	let args = [];
	if( opts.account ) {
		where.push( 'id IN (SELECT transaction_id FROM flows WHERE account_id GLOB ?)' );
		args.push( opts.account );
	}
	if( opts.after ) {
		where.push( 'date>?' );
		args.push( opts.after );
	}
	if( opts.before ) {
		where.push( 'date<?' );
		args.push( opts.before );
	}

	return db.all(
		`SELECT account_id, transaction_id, date, reason, commited, value
		FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
		${where.length ? 'WHERE '+where.join(' AND ') : ''}
		ORDER BY date DESC`,
		args
	).then( ( rows ) => {

		let transactions = {};
		let ret = [];
		for( let flow of rows ) {
			if( ! transactions[ flow.transaction_id ] ) {
				transactions[ flow.transaction_id ] = {
					_id: flow.transaction_id,
					date: new Date( flow.date ),
					reason: flow.reason,
					data: ( typeof flow.data == 'string' ) ? JSON.parse( flow.data ) : null,
					commited: flow.commited === 1,
					flow: {}
				};
				transactions[ flow.transaction_id ].__proto__ = this._transactionPrototype;
				ret.push( transactions[ flow.transaction_id ] );
			}
			transactions[ flow.transaction_id ].flow[ flow.account_id ] = flow.value / this._accuracy;
		}

		return ret;

	} );

}
