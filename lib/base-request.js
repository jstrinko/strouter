var fast_bindall = require(process.env.SRCTOP + '/fast-bindall/lib/fast-bindall'),
	async = require('async'),
	_ = require('underscore');

var Base_Request = function(options) {
	_.extend(this, options);
};

_.extend(Base_Request.prototype, {
	fulfill: function() {
		this.res.send("Ok");
	},
	respond: function(error) {
		if (error || !this.response) {
			return this.res.status(500).send({ error: error });
		}
		return this.res.send(this.response);
	}
});

module.exports = Base_Request;
