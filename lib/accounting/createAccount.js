'use strict';

const jsongate = require('json-gate');

module.exports = function (db, data) {
	// Convert date to string
	if (data && data.dateOpened instanceof Date) data.dateOpened = data.dateOpened.toISOString();

	// Check given dataset
	jsongate.createSchema({
		type: 'object',
		required: true,
		properties: {
			id: { type: 'string', minLength: 1, maxLength: 128, pattern: '^[0-9a-zA-Z/]*$', required: true },
			dateOpened: { type: 'string', format: 'date-time', default: new Date().toISOString() },
			description: { type: 'string', default: '' },
			data: { type: [ 'object', 'null' ] }
		}
	}).validate(data);

	let parentCheck;
	if (data.id.indexOf('/') === -1) {
		// Is root account? -> Skip parent check
		parentCheck = Promise.resolve({ cnt: 1 });
	} else {
		// Look for parent account
		parentCheck = db.get(
			'SELECT COUNT(*) AS cnt FROM accounts WHERE id=? AND dateOpened<=? AND dateClosed IS NULL',
			[data.id.substr(0, data.id.indexOf('/')), data.dateOpened]
		);
	}

	return parentCheck.then((res) => {
		if (res.cnt !== 1) {
			return Promise.reject(new Error(
				`Parent account '${data.id.substr(0, data.id.indexOf('/'))}' is missing, opened in the future or closed`
			));
		}

		return db.run('INSERT INTO accounts (id,dateOpened,description,data) VALUES (?,?,?,?);', [
			data.id,
			data.dateOpened,
			data.description,
			(data.data === undefined || data.data === null) ? null : JSON.stringify(data.data)
		]).catch((e) => {
			if (e.code === 'SQLITE_CONSTRAINT') {
				return Promise.reject(new Error('Account id already existing'));
			}
			return e;
		});
	});
};
