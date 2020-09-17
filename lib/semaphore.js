'use strict';

function Semaphore (capacity) {
	if (typeof capacity !== 'number') throw new Error('Capacity must be a number');
	this.tokens = capacity;
	this.stack = [];
}

Semaphore.prototype._handleStack = function () {
	// If we have tokens and processes are in the queue, execute them
	while (this.tokens > 0 && this.stack.length) {
		this.tokens--;
		this.stack.shift()();
	}
};

Semaphore.prototype.take = function () {
	return new Promise((resolve) => {
		// Push job to stack
		this.stack.push(resolve);
		this._handleStack();
	});
};

Semaphore.prototype.leave = function () {
	// Increase tokens
	this.tokens++;
	setImmediate(() => this._handleStack());
};

module.exports = Semaphore;
