var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	_ = require('underscore'),
	logger = require(process.env.SRCTOP + '/logger/lib/logger'),
	config = require(process.env.SRCTOP + '/config/lib/config'), 
	express = require('express');

var Strouter = function(options) {
	_.extend(this, options);
	fast_bindall(this);
	this.sites = {};
	this.definitions = {};
	this.load_config_files();
	this.express = express();
	this.init_sites();
	this.init_strouter_routes();
};

(new logger({
	filename: 'strouter-%Y%m%d.log', 
	console: false,
	symlink: 'strouter.log'
})).extend(Strouter.prototype);

_.extend(Strouter.prototype, config.prototype, {
	start: function() {
		this.express.listen(process.env.HTTP_PORT);
	},
	init_strouter_routes: function() {
		this.express.all('/strouter/*', this.handle_strouter_request);
		this.express.all('*', this.handle_site_request);
	},
	init_sites: function() {
		_.each(Object.keys(this.configuration.sites), this.load_site);
	},
	load_site: function(key) {
		this.definitions[key] = require(this.configuration.sites[key]);
		this.sites[key] = new this.definitions[key]();
	},
	handle_strouter_request: function(req, res) {
		res.send("Coming soon");
	},
	handle_site_request: function(req, res) {
		if (this.sites[req.headers.host]) {
			this.sites[req.headers.host].handle_request(req, res);
		}
		else {
			return res.status(404).end();
		}
	}
});

module.exports = Strouter;
