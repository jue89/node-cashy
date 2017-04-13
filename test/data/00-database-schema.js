module.exports = {
	'v1': ( db ) => Promise.all( [
		db.run( 'CREATE TABLE t1(c11 INTEGER);' ),
		db.run( 'CREATE TABLE t2(c21 INTEGER);' )
	] ),
	'v1fail': ( db ) => Promise.reject( new Error( "Failed!" ) ),
	'v2': ( db ) => Promise.all( [
		db.run( 'CREATE TABLE t3(c31 INTEGER);' )
	] ),
	'v3': ( db ) => Promise.all( [
		db.run( 'CREATE TABLE t4(c41 INTEGER);' )
	] ),

	'foreign_key': ( db ) => Promise.all( [
		db.run(
			`CREATE TABLE parent (
				id INTEGER NOT NULL PRIMARY KEY
			) WITHOUT ROWID;`
		),
		db.run(
			`CREATE TABLE child (
				id INTEGER NOT NULL PRIMARY KEY,
				parent INTEGER NOT NULL,
				FOREIGN KEY(parent) REFERENCES parent(id) ON DELETE RESTRICT ON UPDATE RESTRICT
			) WITHOUT ROWID;`
		),
	] ),
};
