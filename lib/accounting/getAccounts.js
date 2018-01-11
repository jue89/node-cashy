'use strict';

const jsongate = require('json-gate');
const obj = require('../objhelper.js');

module.exports = function (db, opts) {
	// Factory: Prototype for account methods
	if (!this._Account) {
		const self = this;
		this._Account = function (row) {
			// Make sure the user is not able to alter this data.
			// Class methods will rely on them for right decisions!
			obj(this).setImmutable({
				id: row.id,
				description: row.description,
				dateOpened: new Date(row.dateOpened),
				dateClosed: (typeof row.dateClosed === 'string') ? new Date(row.dateClosed) : null,
				data: (typeof row.data === 'string') ? JSON.parse(row.data) : null
			});
		};
		this._Account.prototype.balance = function (opts) {
			// Check options
			if (opts === undefined) opts = {};
			if (opts.date instanceof Date) opts.date = opts.date.toISOString();
			jsongate.createSchema({
				type: 'object',
				properties: {
					date: { type: 'string', format: 'date-time' }
				}
			}).validate(opts);

			const where = [];
			const args = [];
			where.push('(account_id=? OR account_id GLOB ?)');
			args.push(this.id, this.id + '/*');
			if (opts.date) {
				where.push('date<=?');
				args.push(opts.date);
			}

			return db.get(
				`SELECT SUM(amount) as balance
				FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
				WHERE ${where.join(' AND ')}`,
				args
			).then((res) => {
				const balance = res.balance * ((self._invert.test(this.id)) ? -1 : 1);
				return balance / self._accuracy;
			});
		};
		this._Account.prototype.close = function (opts) {
			// Check options
			if (opts === undefined) opts = {};
			if (opts.date instanceof Date) opts.date = opts.date.toISOString();
			jsongate.createSchema({
				type: 'object',
				properties: {
					date: { type: 'string', format: 'date-time', default: new Date().toISOString() }
				}
			}).validate(opts);

			// Check if any sub accounts are still open
			return db.get(
				`SELECT COUNT(*) AS cnt
				FROM accounts
				WHERE id GLOB ? AND dateClosed IS NULL`,
				this.id + '/*'
			).then((res) => {
				if (res.cnt) {
					return Promise.reject(new Error('Sub accounts must be closed before closing an account'));
				}

				// Check if pending transactions are related to this account
				return db.get(
					`SELECT COUNT(*) AS cnt
					FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
					WHERE account_id=? AND commited=0`,
					this.id
				);
			}).then((res) => {
				if (res.cnt) {
					return Promise.reject(new Error('Before closing an account all related transactions must be commited'));
				}

				// Check if transactions occured after the closing date
				return db.get(
					`SELECT COUNT(*) AS cnt
					FROM flows INNER JOIN transactions ON flows.transaction_id = transactions.id
					WHERE account_id=? AND date>?`,
					[ this.id, opts.date ]
				);
			}).then((res) => {
				if (res.cnt) {
					return Promise.reject(new Error('Transactions occured after the stated closing date'));
				}

				// Check if account balance is zero
				return db.get(
					'SELECT SUM(amount) as balance FROM flows WHERE account_id=?',
					this.id
				);
			}).then((res) => {
				if (res.balance) {
					return Promise.reject(new Error('Before closing an account its balance must be zero'));
				}

				// Finally close the account
				return db.run(
					'UPDATE accounts SET dateClosed=? WHERE id=?',
					[ opts.date, this.id ]
				);
			});
		};
		this._Account.prototype.delete = function () {
			// Check if any sub accounts are present
			return db.get(
				`SELECT COUNT(*) AS cnt
				FROM accounts
				WHERE id GLOB ?`,
				this.id + '/*'
			).then((res) => {
				if (res.cnt) {
					return Promise.reject(new Error('Cannot delete accounts with sub accounts'));
				}

				return db.run('DELETE FROM accounts WHERE id=?', this.id).catch((e) => {
					if (e.code === 'SQLITE_CONSTRAINT') {
						return Promise.reject(new Error('Account has associated transactions'));
					}
					return e;
				});
			});
		};
		this._Account.prototype.update = function (opts) {
			// Check options
			jsongate.createSchema({
				type: 'object',
				required: true,
				properties: {
					description: { type: 'string' },
					data: { type: 'object' }
				}
			}).validate(opts);

			// Create query
			const set = [];
			const args = [];
			if (opts.description) {
				set.push('description=?');
				args.push(opts.description);
			}
			if (opts.data) {
				set.push('data=?');
				args.push(JSON.stringify(opts.data));
			}
			args.push(this.id);

			if (set.length === 0) {
				return Promise.reject(new Error('No data stated'));
			}

			return db.run(
				`UPDATE accounts SET ${set.join(',')} WHERE id=?`,
				args
			);
		};
	}

	// Check options
	if (opts === undefined) opts = {};
	if (opts.date instanceof Date) opts.date = opts.date.toISOString();
	jsongate.createSchema({
		type: 'object',
		properties: {
			id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/*]*$' },
			date: { type: 'string', format: 'date-time' }
		}
	}).validate(opts);

	const where = [];
	const args = [];
	if (opts.date) {
		where.push('dateOpened<=? AND (dateClosed IS NULL OR dateClosed>?)');
		args.push(opts.date, opts.date);
	}
	if (opts.id) {
		where.push('id GLOB ?');
		args.push(opts.id);
	}

	return db.all(
		`SELECT * FROM accounts${where.length ? ' WHERE ' + where.join(' OR ') : ''} ORDER BY id;`,
		args
	).then((rows) => {
		// Convert returned objects
		for (let r in rows) {
			rows[r] = new this._Account(rows[r]);
		}
		return rows;
	});
};
