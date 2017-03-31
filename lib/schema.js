'use strict';

module.exports = [
	( db ) => Promise.all( [
		db.run( `CREATE TABLE accounts (
			id TEXT NOT NULL PRIMARY KEY,
			dateOpened TEXT NOT NULL,
			dateClosed TEXT,
			description TEXT,
			data TEXT
		) WITHOUT ROWID;` )
	] )
];
