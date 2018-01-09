'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('closeAccount <account_id>')
	.option('-c, --closed <date>', 'closing date')
	.description('closes stated account')
	.action(closeAccount);

function closeAccount (id, opts) {
	// Closing opts
	let closingOpts = {};
	if (opts.closed) closingOpts.date = new Date(opts.closed);

	Cashy({
		create: false,
		file: opts.parent.file
	}).getAccounts({ id: id }).then((accounts) => {
		if (!accounts.length) {
			return Promise.reject(
			new Error(`Account ${id} not found`)
		);
		}
		return accounts[0].close(closingOpts);
	}).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
