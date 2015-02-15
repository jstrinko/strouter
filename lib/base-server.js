var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	fs = require('fs'),
	mongo = require('mongodb').MongoClient,
	_ = require('underscore');

var Base_Server = function() {
	this.mongo_connected = false;
	this.route_regexes = {};
	this.caches = {};
	this.dynamic_definitions = {};
	fast_bindall(this);
	this.init_routes();
	this.init_mongo();
};

Base_Server.prototype.handler_map = {
	'file': 'handle_file',
	'dynamic': 'handle_dynamic'
};

_.extend(Base_Server.prototype, {
	handle_request: function(req, res) {
		var that = this;
		this.find_route(req, function() {
			if (!req.route_id) {
				return res.status(404).end();
			}
			that.perform_route(req, res);
		});
	},
	basic_auth: function(req, res, next) {
		var that = this;
		this.find_route(req, function() {
			if (!req.route_id) {
				return process.nextTick(next);
			}
			that.handle_auth(req, res, next);
		});
	},
	handle_auth: function(req, res, next) {
		var route = this.routes[req.route_id];
		if (!route.auth) {
			return process.nextTick(next);
		}
		var auth = req.get('Authorization');
		if (auth) {
			var creds = auth.split(/\s/);
			var user_pass = new Buffer(creds[1], 'base64').toString('ascii').split(/:/);
			if (user_pass[0] === route.auth.username && user_pass[1] === route.auth.password) {
				return process.nextTick(next);
			}
		}
		res.setHeader('WWW-Authenticate', 'Basic realm="' + this.package_name + '"');
		res.status(401).end();
	},
	perform_route: function(req, res) {
		var route = this.routes[req.route_id];
		var type = route.type;
		if (type && this.handler_map[type] && this[this.handler_map[type]]) {
			this[this.handler_map[type]](route, req, res);
		}
		else {
			res.status(500).end();
		}
	},
	handle_file: function(route, req, res) {
		if (route['content-type']) {
			res.setHeader('content-type', route['content-type']);
		}
		var full_path = process.env.SRCTOP + '/' + this.package_name + '/' + route.source;
		this.strouter.stream_file(full_path, req, res);
	},
	handle_dynamic: function(route, req, res) {
		if (route['content-type']) {
			res.setHeader('content-type', route['content-type']);
		}
		var definition = this.dynamic_definitions[route.id];
		if (definition) {
			var request = new definition({ req: req, res: res, server: this });
			request.fulfill();
		}
		else {
			res.status(500).end();
		}
	},
	find_route: function(req, callback) {
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
			function(id) {
				req.route_id = id;
				process.nextTick(callback);
			}
		);
	},
	init_routes: function() {
		this.route_regexes = {};
		_.each(
			Object.keys(this.routes || {}),
			this.init_route
		)
	},
	init_route: function(route_id) {
		var route = this.routes[route_id];
		route.id = route_id;
		this.build_route_regex(route_id);
		this.load_dynamic_route(route_id);
	},
	build_route_regex: function(route) {
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
	},
	load_dynamic_route: function(route_id) {
		var route = this.routes[route_id];
		if (route.type === 'dynamic') {
			var full_path = process.env.SRCTOP + '/' + this.package_name + '/' + route.source;
			this.dynamic_definitions[route_id] = require(full_path);
		}
	},
	init_mongo: function() {
		if (!this.mongo_url) {
			return;
		}
		var that = this;
		mongo.connect(this.mongo_url, function(error, db) {
			if (error) {
				console.warn(error);
				return;
			}
			that.mongo_connected = true;
			that.db = db;
		});
	},
	insert_record: function(collection, data, callback) {
		if (!this.mongo_connected) {
			return callback("Server is not connected to Mongo");
		}
		var collection = this.db.collection(collection);
		collection.insert([data], callback);
	},
	fetch_records: function(collection, query, options, callback) {
		if (!this.mongo_connected) {
			return callback("Server is not connected to Mongo");
		}
		var collection = this.db.collection(collection);
		collection.find(query, options).toArray(callback);
	}
});

module.exports = Base_Server;

