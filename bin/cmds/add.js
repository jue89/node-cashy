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
	const invert = new RegExp(opts.parent.invert);
	let flowWithoutAmount = null;
	const flows = {};
	let sum = 0;
	for (let a in actn) {
		const flow = actn[a].split(':');

		// Flow without amount
		if (flow.length === 1) {
			// Make sure only one account is without amount
			if (flowWithoutAmount !== null) throw new Error('Amount can be omitted at only one account');
			flowWithoutAmount = flow[0];
			continue;
		}

		flows[flow[0]] = parseFloat(flow[1]);
		sum += parseFloat(flow[1]) * (invert.test(flow[0]) ? -1 : 1);
	}
	if (flowWithoutAmount !== null) {
		// Fill the account without amount with
		flows[flowWithoutAmount] = sum * (invert.test(flowWithoutAmount) ? 1 : -1);
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
