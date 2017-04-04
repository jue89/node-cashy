'use strict';

const jsongate = require( 'json-gate' );

module.exports = function( db, opts ) {

	// Factory: Prototype for account methods
	if( ! this._accountPrototype ) {
		const self = this;
		this._accountPrototype = {};
		this._accountPrototype.balance = function( opts ) {

			// Check options
			if( opts === undefined ) opts = {};
			if( opts.date instanceof Date ) opts.date = opts.date.toISOString();
			jsongate.createSchema( { type: 'object', default: {}, properties: {
				date: { type: 'string', format: 'date-time' }
			} } ).validate( opts );

			let where = [];
			let args = [];
			where.push( '(account_id=? OR account_id GLOB ?)' );
			args.push( this.id, this.id + "/*" );
			if( opts.date ) {
				where.push( 'date<=?' );
				args.push( opts.date );
			}

			return db.get(
				`SELECT SUM(value) as balance
				FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
				WHERE ${where.join(' AND ')}`,
				args
			).then( ( res ) => {
				return res.balance / self._accuracy;
			} );
		};
		this._accountPrototype.close = function( opts ) {

			// Check options
			if( opts === undefined ) opts = {};
			if( opts.date instanceof Date ) opts.date = opts.date.toISOString();
			jsongate.createSchema( { type: 'object', default: {}, properties: {
				date: { type: 'string', format: 'date-time', default: new Date().toISOString() }
			} } ).validate( opts );

			// Check if any sub accounts are still open
			return db.get(
				`SELECT COUNT(*) AS cnt
				FROM accounts
				WHERE id GLOB ? AND dateClosed IS NULL`,
				this.id + '/*'
			).then( ( res ) => {

				if( res.cnt ) return Promise.reject(
					new Error( "Sub accounts must be closed before closing an account" )
				);

				// Check if pending transactions are related to this account
				return db.get(
					`SELECT COUNT(*) AS cnt
					FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
					WHERE account_id=? AND commited=0`,
					this.id
				);

			} ).then( ( res ) => {

				if( res.cnt ) return Promise.reject(
					new Error( "Before closing an account all related transactions must be commited" )
				);

				// Check if transactions occured after the closing date
				return db.get(
					`SELECT COUNT(*) AS cnt
					FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
					WHERE account_id=? AND date>?`,
					[ this.id, opts.date ]
				);

			} ).then( ( res ) => {

				if( res.cnt ) return Promise.reject(
					new Error( "Transactions occured after the stated closing date" )
				);

				// Check if account balance is zero
				return db.get(
					'SELECT SUM(value) as balance FROM flows WHERE account_id=?',
					this.id
				);

			} ).then( ( res ) => {

				if( res.balance ) return Promise.reject(
					new Error( "Before closing an account its balance must be zero" )
				);

				// Finally close the account
				return db.run( 'UPDATE accounts SET dateClosed=?', opts.date );

			} );

		};
		this._accountPrototype.delete = function() {
			// Check if any sub accounts are present
			return db.get(
				`SELECT COUNT(*) AS cnt
				FROM accounts
				WHERE id GLOB ?`,
				this.id + '/*'
			).then( ( res ) => {

				if( res.cnt ) return Promise.reject(
					new Error( "Cannot delete accounts with sub accounts" )
				);

				return db.run( 'DELETE FROM accounts WHERE id=?', this.id );

			} );
		};
	}


	// Check options
	if( opts === undefined ) opts = {};
	if( opts.date instanceof Date ) opts.date = opts.date.toISOString();
	jsongate.createSchema( { type: 'object', default: {}, properties: {
		id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/\*]*$' },
		date: { type: 'string', format: 'date-time' }
	} } ).validate( opts );

	let where = [];
	let args = [];
	if( opts.date ) {
		where.push( 'dateOpened<=? AND (dateClosed IS NULL OR dateClosed>?)' );
		args.push( opts.date, opts.date );
	}
	if( opts.id ) {
		where.push( 'id GLOB ?' );
		args.push( opts.id );
	}

	return db.all(
		`SELECT * FROM accounts${where.length ? ' WHERE ' + where.join(' OR ') : ''} ORDER BY id;`,
		args
	).then( ( rows ) => {

		// Convert strings back to objects
		for( let r in rows ) {
			if( typeof rows[r].data == 'string' ) rows[r].data = JSON.parse( rows[r].data );
			if( typeof rows[r].dateOpened == 'string' ) rows[r].dateOpened = new Date( rows[r].dateOpened );
			if( typeof rows[r].dateClosed == 'string' ) rows[r].dateClosed = new Date( rows[r].dateClosed );
			rows[r].__proto__ = this._accountPrototype;
		}

		return rows;

	} );

}
