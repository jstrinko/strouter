var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	fs = require('fs'),
	async = require('async'),
	_ = require('underscore'),
	bodyParser = require('body-parser'),
	compression = require('compression'),
	logger = require(process.env.SRCTOP + '/logger/lib/logger'),
	config = require(process.env.SRCTOP + '/config/lib/config'), 
	file_sender_request = require(process.env.SRCTOP + '/strouter/lib/file-sender-request'),
	express = require('express');

var Strouter = function(options) {
	_.extend(this, options);
	fast_bindall(this);
	this.sites = {};
	this.watched_files = {};
	this.definitions = {};
	this.file_cache = { deflate: {}, gzip: {}, raw: {} };
	this.load_config_files();
	this.express = express();
	this.init_sites();
	this.init_middleware();
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
		this.express.all('/bower/:lib/:file', this.handle_bower_request);
		this.express.all('/bower/:lib/:subdir/:file', this.handle_bower_request);
		this.express.all('/strouter/*', this.handle_strouter_request);
		this.express.all('*', this.handle_site_request);
	},
	init_sites: function() {
		_.each(Object.keys(this.configuration.sites), this.load_site);
	},
	load_site: function(key) {
		this.definitions[key] = require(this.configuration.sites[key]);
		this.sites[key] = new this.definitions[key]();
		this.sites[key].strouter = this;
	},
	handle_strouter_request: function(req, res) {
		res.send("Coming soon");
	},
	extensions_map: {
		'js': 'text/javascript',
		'css': 'text/css'
	},
	handle_bower_request: function(req, res) {
		var full_path = process.env.SRCTOP + 
			'/strouter/bower_components/' + 
			req.param('lib') + '/' + 
			(req.param('subdir') ? req.param('subdir') + '/' : '') +
			req.param('file');
		var parts = req.param('file').match(/.*\.(.*?)$/);
		var extension = (parts && (parts.length > 1)) ? parts[1] : 'js'
		return this.stream_file(full_path, req, res, { 'content-type': this.extensions_map[extension] });
	},
	stream_file: function(full_path, req, res, headers) {
		var request = new file_sender_request({
			path: full_path,
			req: req, 
			res: res,
			cache: this.file_cache,
			strouter: this,
			headers: headers
		});
		return request.fulfill();
	},
	handle_site_request: function(req, res) {
		if (this.sites[req.headers.host]) {
			this.sites[req.headers.host].handle_request(req, res);
		}
		else {
			return res.status(404).end();
		}
	},
	init_middleware: function() {
		this.express.use(compression({ threshold: 512 }));
		this.express.use(this.request_logger);
		this.express.use(this.basic_auth);
		this.express.use(bodyParser.json());
	},
	request_logger: function(req, res, next) {
		req.start_time = +(new Date());
		var that = this;
		res.on('finish', function() {
			that.log_and_finish_req(req, res);
		});
		res.on('close', function() {
			that.log_and_finish_req(req, res);
		});
		return process.nextTick(next);
	},
	basic_auth: function(req, res, next) {
		if (this.sites[req.headers.host]) {
			return this.sites[req.headers.host].basic_auth(req, res, next);
		}
		return process.nextTick(next);
	},
	log_and_finish_req: function(req, res) {
		var elapsed = new Date() - req.start_time;
		this.info([
			req.method,
			req.headers.host,
			req.url,
			res.statusCode,
			res.get('Content-Length'),
			elapsed,
			req.headers.referer,
			req.headers['user-agent'],
			req.ip,
			req.headers['x-forwarded-for']
		].join(' '));
	},
	watch_file: function(path) {
		if (this.watched_files[path]) {
			return;
		}
		this.watched_files[path] = true;
		var that = this;
		fs.watch(
			path,
			function(event, filename) {
				console.warn("CHANGE TO:", filename);
				delete that.file_cache.raw[path];
				delete that.file_cache.deflate[path];
				delete that.file_cache.gzip[path];
				if (event === 'rename') {
					fs.unwatchFile(path);
					delete that.watched_files[path];
					setTimeout(function() {
						that.watch_file(path);
					}, 2000);
				}
			}
		);
	},
});

module.exports = Strouter;
