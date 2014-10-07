var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	_ = require('underscore');

var Base_Request = function(options) {
	_.extend(this, options);
};

Base_Request.prototype.fulfill = function() {
	this.res.send("Ok");
};

module.exports = Base_Request;
