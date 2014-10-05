var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	_ = require('underscore');

var Base_Server = function() {
	this.route_regexes = {};
	fast_bindall(this);
	this.build_route_regexes();
};

Base_Server.prototype.handle_request = function(req, res) {
	this.find_route(req, function(error, route) {
		if (error || !route) {
			return res.status(404).end();
		}
		return res.send(req.headers.host);
	});
};

Base_Server.prototype.find_route = function(req, callback) {
	var that = this;
	async.detectSeries(
		Object.keys(this.route_regexes).reverse(),
		function(route, cb) {
			var regex = that.route_regexes[route];
			var match = req.originalUrl.match(regex);
			console.warn(route, match);
			return process.nextTick(cb);
		},
		callback
	);
};

Base_Server.prototype.build_route_regexes = function() {
	this.route_regexes = {};
	_.each(
		Object.keys(this.routes || {}),
		this.build_route_regex
	)
};

Base_Server.prototype.build_route_regex = function(route) {
	var param_names = [];
	var regex = route.replace(
		/\/\:(\w+)/g, 
		function(match, capture, offset, full_string) {
			param_names.push(capture);
			return "(\w+)";
		}
	);
	this.route_regexes[route] = {
		param_names: param_names,
		regex: new RegExp("^" + regex + "$")
	}
};

module.exports = Base_Server;

