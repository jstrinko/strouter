var cluster = require('cluster'),
	os = require('os'),
	fs = require('fs'),
	commander = require('commander'),
	sexio = require(process.env.SRCTOP + '/sexio/sexio.js'),
	strouter = require('../lib/strouter.js');

commander.option('-c, --config <config>', 'Config File', String, process.env.SRCTOP + '/strouter/config/sexio.json')
	.parse(process.argv);

var spawn_new_worker = true;
if (Cluster.isMaster) {
	Cluster.fork();
	Cluster.on('exit', function(worker) {
		if (spawn_new_worker) {
			Cluster.fork();
		}
	});
}
else {
	var strouter = new strouter();
	var sexio = new sexio({
		config_files: {
			sexio: program.config,
			routes: process.env.SRCTOP + '/strouter/config/sexio-routes.json',
			sites: process.env.SRCTOP + '/strouter/config/sites.json'
		},
		handler: strouter,
	});
}

var express = require('express');
var app = express();

app.all('*', function(req, res) {
	res.send(req.headers.host);
});

app.listen(process.env.HTTP_PORT);
