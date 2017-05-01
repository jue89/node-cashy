'use strict';

const objhelper = require( '../objhelper.js' );

module.exports = function( db ) {

	// Factory: Prototype for account methods
	if( ! this._Export ) {
		const self = this;
		this._Export = function( accounts, transactions ) {
			// Reorder transactions by id
			transactions.sort( (a, b) => {
				if( a.id < b.id ) return -1;
				if( a.id > b.id ) return 1;
				return 0;
			} );
			objhelper.setImmutableProperties( this, {
				accounts: accounts,
				transactions: transactions
			} );
		};
		this._Export.prototype.toString = function( spacer ) {
			return JSON.stringify( this, null, spacer );
		};
	}

	return Promise.all( [
		this.getAccounts(),
		this.getTransactions()
	] ).then( (ret) => new this._Export( ret[0], ret[1] ) );

};
