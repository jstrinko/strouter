var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	fs = require('fs'),
	_ = require('underscore');

var Base_Server = function() {
	this.route_regexes = {};
	this.dynamic_definitions = {};
	fast_bindall(this);
	this.init_routes();
};

Base_Server.prototype.handler_map = {
	'file': 'handle_file',
	'dynamic': 'handle_dynamic'
};

Base_Server.prototype.handle_request = function(req, res) {
	var that = this;
	this.find_route(req, function(route_id) {
		if (!route_id) {
			return res.status(404).end();
		}
		that.perform_route(route_id, req, res);
	});
};

Base_Server.prototype.perform_route = function(route_id, req, res) {
	var route = this.routes[route_id];
	var type = route.type;
	if (type && this.handler_map[type] && this[this.handler_map[type]]) {
		this[this.handler_map[type]](route, req, res);
	}
	else {
		res.status(500).end();
	}
};

Base_Server.prototype.handle_file = function(route, req, res) {
	if (route['content-type']) {
		res.setHeader('content-type', route['content-type']);
	}
	var full_path = process.env.SRCTOP + '/' + this.package_name + '/' + route.source;
	this.strouter.stream_file(full_path, req, res);
};

Base_Server.prototype.handle_dynamic = function(route, req, res) {
	var definition = this.dynamic_definitions[route.id];
	if (definition) {
		var request = new definition({ req: req, res: res });
		request.fulfill();
	}
	else {
		res.status(500).end();
	}
};

Base_Server.prototype.find_route = function(req, callback) {
	var that = this;
	async.detectSeries(
		Object.keys(this.route_regexes).reverse(),
		function(route, cb) {
			var data = that.route_regexes[route];
			var regex = data.regex;
			var match = req.originalUrl.match(regex);
			if (match) {
				var x = 1;
				async.eachSeries(
					data.param_names,
					function(name, cb2) {
						req.params[name] = match[x];
						x++;
						return process.nextTick(cb2);
					},
					function(error) {
						if (error) { process.nextTick(cb); }
						return cb(true);
					}
				);
			}
			else {
				return process.nextTick(cb);
			}
		},
		callback
	);
};

Base_Server.prototype.init_routes = function() {
	this.route_regexes = {};
	_.each(
		Object.keys(this.routes || {}),
		this.init_route
	)
};

Base_Server.prototype.init_route = function(route_id) {
	var route = this.routes[route_id];
	route.id = route_id;
	this.build_route_regex(route_id);
	this.load_dynamic_route(route_id);
};

Base_Server.prototype.build_route_regex = function(route) {
	var param_names = [];
	var regex = route.replace(
		/\/\:(\w+)/g, 
		function(match, capture, offset, full_string) {
			param_names.push(capture);
			return "/(\\w+)";
		}
	);
	this.route_regexes[route] = {
		param_names: param_names,
		regex: new RegExp("^" + regex + "$")
	}
};

Base_Server.prototype.load_dynamic_route = function(route_id) {
	var route = this.routes[route_id];
	if (route.type === 'dynamic') {
		var full_path = process.env.SRCTOP + '/' + this.package_name + '/' + route.source;
		this.dynamic_definitions[route_id] = require(full_path);
	}
};

module.exports = Base_Server;

