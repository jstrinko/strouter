#!/usr/bin/env node

var cluster = require('cluster'),
	os = require('os'),
	fs = require('fs'),
	commander = require('commander'),
	strouter = require('../lib/strouter.js');

commander.option('-c, --config <config>', 'Config File', String, process.env.SRCTOP + '/strouter/config/sites.json')
	.parse(process.argv);

var spawn_new_worker = true;
if (cluster.isMaster) {
	var num_CPUs = os.cpus().length;
	for(var x=0; x<num_CPUs; x++) {
		cluster.fork();
	}
	cluster.on('exit', function(worker) {
		if (spawn_new_worker) {
			cluster.fork();
		}
	});
}
else {
	var router = new strouter({
		config_files: {
			sites: commander.config
		}
	});
	router.start();
}

