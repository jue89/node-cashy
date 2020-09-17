# API

The API description refers to ```Cashy```:

``` javascript
const Cashy = require( 'cashy' );
```

## Cashy

``` javascript
let cashy = new Cashy( options );
```

Opens the database and returns an instance of Cashy.

Object ```options``` may contain:
 * ```file```: Path to the database file. Required.
 * ```invert```: String of a regular expression. If an account matches this regular expression, its balances and transaction amounts are multiplied with -1.
 * ```accuracy```: Decimal places stored in the database. More precise amounts will be rounded half away from zero. If the database already exists the precision the database was created with will be used instead. May be between 0 and 7. Default: 2.
 * ```create```: Boolean indicator if a new database file should be created if the stated is not present. Default: true.

## Class: Cashy

Every instance holds the following properties:
 * ```accuracy```: The accuracy of the database.

### Method: createAccount

``` javascript
cashy.createAccount( account ).then( () => ... );
```
Creates a new account. ```account``` contains required information:
 * ```id```: The account's ID. Sub accounts are separated by '/'. Required (of course).
 * ```description```: Some words about the account.
 * ```dateOpened```: Earliest date for transactions. Default: Current date.
 * ```data```: User-defined store.

### Method: getAccounts

``` javascript
cashy.getAccounts( filter ).then( ( accounts ) => ... );
```
The optional ```filter``` states which accounts to fetch. If multiple are stated they are joined by logical AND:
 * ```id```: Account ID is matching. May contain '\*' as wildcard.
 * ```date```: Accounts are open at the stated date.

The returned promise contains an array of matching ```accounts```. They are an instance of Account. (See below.)

### Method: addTransaction

``` javascript
cashy.addTransaction( metaData, flow ).then( ( id ) => ... );
```
Creates a new transaction. ```flow``` is an object with account IDs as key and mounts as value. All amounts must be zero when summed up. ```metaData``` contains information about the transaction:
 * ```date```: Date of transaction. Default: now.
 * ```reason```: Reason of the transaction. Required.
 * ```data```: User-defined data store attached to the transaction.

The returned promise contains the auto-generated ID of the transaction.


### Method: getTransactions

``` javascript
cashy.getTransactions( filter ).then( ( transactions ) => ... );
```

The optional ```filter``` states which transactions to fetch. If multiple are stated they are joined by logical AND:
 * ```id```: ID of the transaction. Will return zero or one result.
 * ```account```: All transactions related to this account.
 * ```commited```: A boolean indicating if you want to see just (un)committed transactions. (sic! Spelling will be corrected in v2.0.0.)
 * ```after```: Transactions after this date (not including) are returned.
 * ```before```: Transactions before and at this date are returned.

The returned promise contains an array of matching ```transactions```. They are an instance of Transaction. (See below.)


### Method: export

``` javascript
cashy.export().then( ( dump ) => ... );
```

Exports the database to object ```dump```. Calling ```dump.toString()``` will convert this to a string.


### Method: import

``` javascript
cashy.import( dump ).then( () => ... );
```

Imports ```dump``` (object or string) to the database. Please make sure that you import to an empty database or have a backup. Failed imports are not rolled back!


## Class: Account

Every instance holds the following properties:
 * ```id```: The account's ID.
 * ```description```: Further information.
 * ```dateOpened```: Date when the account was opened.
 * ```dateClosed```: Closing date. Is ```null``` if the account is stoll open.
 * ```data```: Store for use-defined data.

### Method: balance

``` javascript
account.balance( filter ).then( ( balance ) => ... );
```

The optional ```filter``` object stores:
 * ```date```: Get the account balance at this certain date.

A promise is returned that will be resolved with the balance.

### Method: close

``` javascript
account.close( options ).then( () => ... );
```

The optional ```options``` may contain:
 * ```date```: Date when the account is closed.

Closes a account. Its balance must be zero.

### Method: delete

``` javascript
account.delete().then( () => ... );
```

Deletes an account. No transactions must be related to this account.

### Method: update

``` javascript
account.update( data ).then( () => ... );
```

Updates the account ```data```:
 * ```description```: Account description.
 * ```data```: User-defined store.

## Class: Transaction

 * ```id```: Numerical ID of the transaction.
 * ```reason```: Reason causing this transaction.
 * ```date```: Date of the transaction.
 * ```commited```: If set to ```true``` the transaction cannot be altered anymore. (sic! Spelling will be corrected in v2.0.0.)
 * ```data```: Store for use-defined data.
 * ```flow```: Array of objects holding involved accounts and the amounts. Key: account, value: amount.

### Method: commit

``` javascript
account.commit().then( () => ... );
```

Commits uncommitted transactions.

### Method: delete

``` javascript
account.delete().then( () => ... );
```

Drops uncommitted transactions. Committed transactions are immutable.
