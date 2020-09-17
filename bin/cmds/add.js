'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('add <account1:amount> <account2:amount> [account3:amount...]')
	.option('-r, --reason <reason>', 'reason for the transaction')
	.option('-d, --date <date>', 'date of the transaction')
	.description('creates new transaction')
	.action(add);

function add (act1, act2, actn, opts) {
	// Parse given accounts
	actn.unshift(act2);
	actn.unshift(act1);
	const flows = {};
	for (let a in actn) {
		const flow = actn[a].split(':');
		flows[flow[0]] = (flow.length === 2 && flow[1] !== '') ? parseFloat(flow[1]) : null;
	}

	// Prepare transaction meta data
	const transaction = {};
	if (typeof opts.date === 'string') transaction.date = new Date(opts.date);
	if (typeof opts.reason === 'string') transaction.reason = opts.reason;

	Cashy({
		create: false,
		file: opts.parent.file,
		invert: opts.parent.invert
	}).addTransaction(transaction, flows).then((id) => {
		console.log(`Added transaction: ${id}`);
	}).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
