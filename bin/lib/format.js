'use strict';

module.exports = function (number, n, x) {
	const re = new RegExp('\\d(?=(\\d{' + (x || 3) + '})+' + (n > 0 ? '\\.' : '$') + ')', 'g');
	return number.toFixed(Math.max(0, ~~n)).replace(re, '$&,');
};
