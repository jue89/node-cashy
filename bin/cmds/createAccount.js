'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('createAccount <account_id>')
	.option('-d, --description <description>', 'description for the account')
	.option('-o, --opened <date>', 'opening date')
	.description('creates new account')
	.action(createAccount);

function createAccount (id, opts) {
	// Create account object
	const account = {};
	account.id = id;
	if (typeof opts.opened === 'string') account.dateOpened = new Date(opts.opened);
	if (typeof opts.description === 'string') account.description = opts.description;

	Cashy({
		create: false,
		file: opts.parent.file
	}).createAccount(account).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
