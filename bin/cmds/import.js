'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('import')
	.description('import database from stdin')
	.action(ex);

function ex (opts) {
	let cashy = Cashy({
		create: false,
		file: opts.parent.file
	});

	let data = [];
	process.stdin.on('data', (chunk) => data.push(chunk));
	process.stdin.on('end', () => {
		cashy.import(Buffer.concat(data).toString()).catch((e) => {
			console.error(e.message);
			process.exit(1);
		});
	});
}
