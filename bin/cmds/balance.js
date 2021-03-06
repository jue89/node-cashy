'use strict';

const Cashy = require('../../index.js');
const Table = require('../lib/table.js');
const format = require('../lib/format.js');

// Output table
const out = new Table(process.stdout);

module.exports = (program) => program
	.command('balance')
	.option('-d, --date <date>', 'balances at this date')
	.option('--csv', 'output comma-separated account list')
	.description('list all accounts including their balances')
	.action(balance);

function balance (opts) {
	const filter = {};
	if (typeof opts.date === 'string') {
		filter.date = (opts.date === 'now') ? new Date() : new Date(opts.date);
	}

	const cashy = Cashy({
		create: false,
		file: opts.parent.file,
		invert: opts.parent.invert
	});

	cashy.getAccounts(filter).then((accounts) => {
		const jobs = [];
		for (let a of accounts) jobs.push(a.balance(filter));
		return Promise.all(jobs).then((balances) => [accounts, balances]);
	}).then((args) => {
		const accounts = args[0];
		const balances = args[1];

		if (opts.csv) {
			for (let a in accounts) {
				console.log(`${accounts[a].id},${balances[a]}`);
			}
		} else {
			// Heading
			out.write('Account', { pos: 1 });
			out.write('Balance', { pos: -1, align: 'right' });
			out.nl();
			out.line('blackBright');
			// Body
			for (let a in accounts) {
				const path = accounts[a].id.split('/');
				const pos = 1 + 2 * (path.length - 1);
				const caption = path.pop();
				out.write(caption, {
					pos: pos
				});
				out.write(format(balances[a], cashy.accuracy), {
					pos: -1,
					align: 'right',
					color: (accounts[a].dateClosed) ? 'blackBright' : (balances[a] >= 0) ? 'green' : 'red'
				});
				out.nl();
			}
		}
	}).catch((e) => {
		console.error(e.message);
		process.exit(1);
	});
}
