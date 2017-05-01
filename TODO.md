# Version 2.0.0

 * Rename ```transaction.commited``` to ```transaction.committed```. This is more aligned with the English language.
 * Merge arguments from ```addTransaction( metaData, flow )``` to ```addTransaction( transaction )``` where ```transaction``` includes all information of ```metaData``` and ```flow```. This is more convenient for cascading promises.
