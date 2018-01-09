'use strict';

const jsongate = require('json-gate');

module.exports = function (db, dump) {
	// Make sure dump is an object
	try {
		if (typeof dump === 'string') dump = JSON.parse(dump);
	} catch (e) {
		return Promise.reject(e);
	}

	// Check dump. Further checks will be carried out later in createAccount/addTransaction method
	jsongate.createSchema({
		type: 'object',
		required: true,
		properties: {
			accounts: { required: true, type: 'array' },
			transactions: { required: true, type: 'array' }
		}
	}).validate(dump);

	const processAccounts = (accounts, closeAccounts) => {
		if (closeAccounts === undefined) closeAccounts = {};
		if (accounts.length === 0) return closeAccounts;
		let a = accounts.shift();
		if (a.dateClosed) closeAccounts[a.id] = a.dateClosed;
		delete a.dateClosed;
		return this.createAccount(a)
			.then(() => processAccounts(accounts, closeAccounts));
	};

	// 1) Create accounts
	return processAccounts(dump.accounts).then((closeAccounts) => {
		// 2) Create transactions
		let addTransactionJobs = [];
		for (let t of dump.transactions) {
			let commited = t.commited;
			delete t.commited;
			let flow = t.flow;
			delete t.flow;
			delete t.id;
			addTransactionJobs.push(this.addTransaction(t, flow).then((id) => {
				if (!commited) return;
				return this.getTransactions({ id: id }).then((t) => t[0].commit());
			}));
		}

		return Promise.all(addTransactionJobs).then(() => {
			// 3) Close accounts
			let closeAccountJobs = [];
			for (let id in closeAccounts) {
				closeAccountJobs.push(this.getAccounts({ id: id }).then((a) => {
					return a[0].close({ date: closeAccounts[id] });
				}));
			}
			return Promise.all(closeAccountJobs);
		});
	});
};
