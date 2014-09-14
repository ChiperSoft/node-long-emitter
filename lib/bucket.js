var debounce = require('lodash.debounce');
var assign = require('lodash.assign');
var proxmis = require('proxmis');
var EventEmitter = require('events').EventEmitter;


function Bucket (options) {
	EventEmitter.call(this);

	options = assign({
		pause: 100,
		maxPause: 500
	}, options || {});

	this._queue = [];
	this._drains = [];

	this.send = debounce(this.send, options.pause, {maxWait: options.maxPause});
}

Bucket.prototype = Object.create(EventEmitter.prototype);

Bucket.prototype._emit = EventEmitter.prototype.emit;

Bucket.prototype.emit = function emit (name) {
	if (this._emit.apply(this, arguments)) {
		return true;
	}

	var evt = arrayFromArguments.apply(null, arguments);

	this._queue.push(evt);

	this.send();

	return false;
};

Bucket.prototype.send = function send () {
	//no pending hooks. How did we get here?
	if (!this._drains.length) return;

	this._drains.shift()(this._queue);
	this._queue = [];
	this._emit('_drained');

	return this;
};

Bucket.prototype.drain = function drain (callback) {
	var p = proxmis({callback: callback, noError: true});
	this._drains.push(p);
	this.send();

	return p;
};

Bucket.prototype.tap = function tap (emitter) {
	if (!emitter || typeof emitter.emit === 'undefined') throw new TypeError('tap function expected to receive EventEmitter.');
	var pending = this._queue;
	this._queue = [];

	pending.forEach(function (evt) {
		emitter.emit.apply(emitter, evt);
	});

	emitter.emit('_drained');
	this._emit('_drained');

	return this;
};


module.exports = Bucket;


/**
* Helper function to convert arguments to an array without triggering de-optimization in V8
* MUST be called via .apply
* @private
* @return {Array<mixed>}
*/
function arrayFromArguments () {
	var len = arguments.length;
	var args = new Array(len);
	for(var i = 0; i < len; ++i) {
		args[i] = arguments[i];
	}
	return args;
}