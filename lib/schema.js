'use strict';

module.exports = [
	(db) => Promise.all([
		db.run(`CREATE TABLE accounts (
			id TEXT NOT NULL PRIMARY KEY,
			dateOpened TEXT NOT NULL,
			dateClosed TEXT,
			description TEXT,
			data TEXT
		) WITHOUT ROWID;`),
		db.run(`CREATE TABLE transactions (
			id INTEGER PRIMARY KEY,
			date TEXT NOT NULL,
			reason TEXT NOT NULL,
			commited INTEGER NOT NULL DEFAULT 0,
			data TEXT
		);`),
		db.run(`CREATE TABLE flows (
			transaction_id INTEGER NOT NULL,
			account_id TEXT NOT NULL,
			amount INTEGER NOT NULL,
			FOREIGN KEY(transaction_id) REFERENCES transactions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
			FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
			PRIMARY KEY(transaction_id,account_id)
		) WITHOUT ROWID;`)
	])
];
