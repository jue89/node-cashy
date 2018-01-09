'use strict';

const Cashy = require('../../index.js');

module.exports = (program) => program
	.command('export')
	.option('-s, --spacer <string>', 'specify spacer')
	.description('export database')
	.action(ex);

function ex (opts) {
	let cashy = Cashy({
		create: false,
		file: opts.parent.file
	});

	cashy.export().then((db) => {
		console.log(db.toString(opts.spacer));
	});
}
