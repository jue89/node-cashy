'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('dropAccount <account_id>')
	.description('closes stated account')
	.action(dropAccount);

function dropAccount (id, opts) {
	Cashy({
		create: false,
		file: opts.parent.file
	}).getAccounts({ id: id }).then((accounts) => {
		if (!accounts.length) {
			return Promise.reject(
			new Error(`Account ${id} not found`)
		);
		}
		return accounts[0].delete();
	}).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
