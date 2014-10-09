var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	_ = require('underscore'),
	fs = require('fs'),
	crypto = require('crypto'),
	zlib = require('zlib');
	
var File_Sender_Request = function(options) {
	_.extend(this, options);
	fast_bindall(this);
};

_.extend(File_Sender_Request.prototype, {
	fulfill: function() {
		async.series([
			this.populate_raw_cache,
			this.populate_deflate_cache,
			this.populate_gzip_cache,
			this.populate_raw_md5,
			this.populate_deflate_md5,
			this.populate_gzip_md5
		], this.respond);
	},
	populate_raw_cache: function(callback) {
		if (this.cache.raw[this.path]) {
			return process.nextTick(callback);
		}
		this.strouter.watch_file(this.path);
		var that = this;
		fs.readFile(this.path, function(error, data) {
			if (error) {
				return callback(error);
			}
			that.cache.raw[that.path] = { buffer: new Buffer(data) };
			return process.nextTick(callback);
		});
	},
	populate_deflate_cache: function(callback) {
		if (this.cache.deflate[this.path]) {
			return process.nextTick(callback);
		}
		var that = this;
		zlib.deflate(this.cache.raw[this.path].buffer, function(error, buffer) {
			if (error) {
				return callback(error);
			}
			that.cache.deflate[that.path] = { buffer: buffer };
			return process.nextTick(callback);
		});
	},
	populate_gzip_cache: function(callback) {
		if (this.cache.gzip[this.path]) {
			return process.nextTick(callback);
		}
		var that = this;
		zlib.gzip(this.cache.raw[this.path].buffer, function(error, buffer) {
			if (error) {
				return callback(error);
			}
			that.cache.gzip[that.path] = { buffer: buffer };
			return process.nextTick(callback);
		});
	},
	populate_raw_md5: function(callback) {
		this.populate_md5_cache('raw', callback);
	},
	populate_deflate_md5: function(callback) {
		this.populate_md5_cache('deflate', callback);
	},
	populate_gzip_md5: function(callback) {
		this.populate_md5_cache('gzip', callback);
	},
	populate_md5_cache: function(type, callback) {
		var cache = this.cache[type][this.path];
		if (cache.md5) {
			return process.nextTick(callback);
		}
		var buf = cache.buffer;
		var md5 = crypto.createHash('md5');
		md5.update(buf);
		cache.md5 = md5.digest('hex');
		return process.nextTick(callback);
	},
	respond: function(error) {
		if (error) {
			return this.res.status(500).send(error);
		}
		var accept = this.req.headers['accept-encoding'] || '';
		if (accept.match(/\bdeflate\b/)) {
			if (this.cache.deflate[this.path].md5 === this.req.headers['if-none-match']) {
				return this.res.status(304).end();
			}
			return this.send_buffer(
				this.cache.deflate[this.path].buffer, 
				{ 
					'content-encoding': 'deflate',
					'ETag': this.cache.deflate[this.path].md5
				}
			);
		}
		else if (accept.match(/\bgzip\b/)) {
			if (this.cache.gzip[this.path].md5 === this.req.headers['if-none-match']) {
				return this.res.status(304).end();
			}
			return this.send_buffer(
				this.cache.gzip[this.path].buffer, 
				{ 
					'content-encoding': 'gzip',
					'ETag': this.cache.gzip[this.path].md5
				}
			);
		}
		else {
			if (this.cache.raw[this.path].md5 === this.req.headers['if-none-match']) {
				return this.res.status(304).end();
			}
			return this.send_buffer(
				this.cache.raw[this.path].buffer,
				{ 'ETag': this.cache.raw[this.path].md5 }
			);
		}
	},
	send_buffer: function(buf, headers) {
		var headers_to_set = headers || {};
		headers_to_set['Cache-Control'] = 'max-age=3153600';
		if (this.headers) {
			_.extend(headers_to_set, this.headers);
		}
		this.res.writeHead(200, headers_to_set);
		this.res.write(buf);
		this.res.end();
	}
});

module.exports = File_Sender_Request;
