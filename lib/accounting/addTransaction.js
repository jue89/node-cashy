'use strict';

const jsongate = require( 'json-gate' );

module.exports = function( db, data, flows ) {

	// Convert dates to strings
	if( data.date instanceof Date ) data.date = data.date.toISOString();

	// Check given dataset
	jsongate.createSchema( { type: 'object', properties: {
		date: { type: 'string', format: 'date-time', default: new Date().toISOString() },
		reason: { type: 'string', required: true },
		data: { type: 'object' }
	} } ).validate( data );
	jsongate.createSchema( { type: 'object', additionalProperties: false, patternProperties: {
		'^[0-9a-zA-Z/]*$': { type: 'number', maximum: this._maxint }
	} }).validate( flows );
	if( Object.keys( flows ).length === 0 ) return Promise.reject(
		new Error( "At least two accounts must be involved in a transaction" )
	);

	// Check if all involved accounts are open
	let where = [];
	let args = [];
	for( let account in flows ) {
		where.push( 'id=? AND dateOpened>?' );
		args.push( account, data.date );
	}
	return db.all(
		`SELECT id FROM accounts WHERE ${where.join(' OR ')};`,
		args
	).then( ( rows ) => {

		if( rows.length !== 0 ) {
			for( let r in rows ) rows[r] = rows[r].id;
			return Promise.reject(
				new Error( `${rows.join(' and ')} is not open on the date of the transaction` )
			);
		}

		// Create transaction
		let id;
		return db.transaction( ( db ) => db.run(
			'INSERT INTO transactions (date,reason,data) VALUES (?,?,?)',
			[ data.date, data.reason, JSON.stringify(data.data) ]
		).then( () => db.get( 'SELECT last_insert_rowid() as id;' ) ).then( ( res ) => {

			const id = res.id;

			let jobs = [];
			let sum = 0;

			for( let account in flows ) {
				let amount = Math.round(flows[account] * this._accuracy);
				sum += amount;
				jobs.push( db.run(
					'INSERT INTO flows (transaction_id,account_id,amount) VALUES (?,?,?);',
					[ id, account, amount ]
				) );
			}

			// If the sum does not equal zero, wait for all jobs to be finshed
			// and then rollback the whole transaction.
			if( sum !== 0 ) return Promise.all( jobs ).then( () => Promise.reject(
				new Error( "Sum of all amounts must be equal zero" )
			) );

			return Promise.all( jobs ).then( () => id );

		} ) );

	} );

};
