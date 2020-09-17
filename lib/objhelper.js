'use strict';

function ObjHelper (obj) {
	this.obj = obj;
}

ObjHelper.prototype.setHidden = function (properties) {
	for (let key in properties) {
		Object.defineProperty(this.obj, key, {
			writable: false,
			enumerable: false,
			value: properties[key]
		});
	}
	return this;
};

ObjHelper.prototype.setImmutable = function (properties) {
	for (let key in properties) {
		Object.defineProperty(this.obj, key, {
			writable: false,
			enumerable: true,
			value: properties[key]
		});
	}
	return this;
};

module.exports = (obj) => new ObjHelper(obj);
