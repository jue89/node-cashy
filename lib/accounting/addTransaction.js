'use strict';

const jsongate = require('json-gate');

module.exports = function (db, data, flows) {
	// Convert dates to strings
	if (data && data.date instanceof Date) data.date = data.date.toISOString();

	// Check given dataset
	jsongate.createSchema({
		type: 'object',
		required: true,
		properties: {
			date: { type: 'string', format: 'date-time', default: new Date().toISOString() },
			reason: { type: 'string', required: true },
			data: { type: [ 'object', 'null' ] }
		}
	}).validate(data);
	jsongate.createSchema({
		type: 'object',
		required: true,
		additionalProperties: false,
		patternProperties: { '^[0-9a-zA-Z/]*$': {
			type: ['number', 'null'],
			maximum: this._maxint
		} }
	}).validate(flows);
	if (Object.keys(flows).length === 0) {
		return Promise.reject(new Error('At least two accounts must be involved in a transaction'));
	}

	// Check if all involved accounts are open
	const where = [];
	const args = [];
	for (let account in flows) {
		where.push('id=?');
		args.push(account);
	}
	return db.all(
		`SELECT id,dateOpened,dateClosed FROM accounts WHERE ${where.join(' OR ')};`,
		args
	).then((rows) => {
		// Convert result
		const dates = {};
		for (let r of rows) dates[r.id] = [r.dateOpened, r.dateClosed];

		// Check all accounts
		for (let account in flows) {
			if (dates[account] === undefined) {
				return Promise.reject(new Error(`${account} does not exist`));
			}
			if (dates[account][1] !== null) {
				return Promise.reject(new Error(`${account} is closed`));
			}
			if (dates[account][0] > data.date) {
				return Promise.reject(new Error(`${account} is not open on the date of the transaction`));
			}
		}

		// Create transaction
		return db.transaction((db) => db.run(
			'INSERT INTO transactions (date,reason,data) VALUES (?,?,?)', [
				data.date,
				data.reason,
				(data.data === undefined || data.data === null) ? null : JSON.stringify(data.data)
			]
		).then(() => db.get('SELECT last_insert_rowid() as id;')).then((res) => {
			const id = res.id;

			const jobs = [];
			let sum = 0;
			let flowWithoutAmount = null;
			for (let account in flows) {
				// Skip flows with 'null'. Their amount is calculated in the end.
				if (flows[account] === null) {
					if (flowWithoutAmount !== null) {
						return Promise.all(jobs)
							.then(() => Promise.reject(new Error('Amount can be omitted at only one account')));
					}
					flowWithoutAmount = account;
					continue;
				}

				const amount = Math.round(flows[account] * ((this._invert.test(account)) ? -1 : 1) * this._accuracy);
				jobs.push(db.run(
					'INSERT INTO flows (transaction_id,account_id,amount) VALUES (?,?,?);',
					[id, account, amount]
				));
				sum += amount;
			}

			// Insert omitted account
			if (flowWithoutAmount !== null) {
				jobs.push(db.run(
					'INSERT INTO flows (transaction_id,account_id,amount) VALUES (?,?,?);',
					[id, flowWithoutAmount, -sum]
				));
				sum = 0;
			}

			// If the sum does not equal zero, wait for all jobs to be finshed
			// and then rollback the whole transaction.
			if (sum !== 0) {
				return Promise.all(jobs)
					.then(() => Promise.reject(new Error('Sum of all amounts must be equal zero')));
			}

			return Promise.all(jobs).then(() => id);
		}));
	});
};
