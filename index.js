'use strict';

const Accounting = require('./lib/accounting.js');

module.exports = function (opts) {
	return new Accounting(opts);
};
