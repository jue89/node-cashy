'use strict';

function setImmutableProperties (obj, properties) {
	for (let key in properties) {
		Object.defineProperty(obj, key, {
			writable: false,
			enumerable: true,
			value: properties[key]
		});
	}
}

function setHiddenProperties (obj, properties) {
	for (let key in properties) {
		Object.defineProperty(obj, key, {
			writable: false,
			enumerable: false,
			value: properties[key]
		});
	}
}

module.exports = { setImmutableProperties, setHiddenProperties };
