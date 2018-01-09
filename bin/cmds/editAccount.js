'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('editAccount <account_id>')
	.option('-d, --description <description>', 'new description for the account')
	.description('alters stated account')
	.action(editAccount);

function editAccount (id, opts) {
	let data = {};
	data.description = opts.description;

	Cashy({
		create: false,
		file: opts.parent.file
	}).getAccounts({ id: id }).then((accounts) => {
		if (!accounts.length) {
			return Promise.reject(
			new Error(`Account ${id} not found`)
		);
		}
		return accounts[0].update(data);
	}).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
