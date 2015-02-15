var config_def = require(process.env.SRCTOP + '/config/lib/config'),
	SRCTOP = process.env.SRCTOP,
	_ = require('underscore'),
	config = new config_def();

config.config_files = {
	sites: SRCTOP + '/strouter/config/sites.json'
},
config.load_config_files();
var sites = config.configuration.sites;
var grunt_config = {
	clean: {} 
};
_.each(
	Object.keys(sites),
	function(key) {
		var def = require(sites[key]);
		var instance = new def();
		var routes = instance.routes;
		grunt_config.clean[instance.package_name] = {
			options: { 
				force: true
			},
			src: [
				SRCTOP + '/' + instance.package_name + '/tmp/*',
				SRCTOP + '/' + instance.package_name + '/build/*'
			]
		};
		_.each(
			Object.keys(routes),
			function(route_id) {
				var grunt_info = routes[route_id].grunt_info;
				if (!grunt_info) {
					return;
				}
				_.each(
					Object.keys(grunt_info),
					function(info_key) {
						if (!grunt_config[info_key]) {
							grunt_config[info_key] = {};
						}
						console.warn(info_key);
						grunt_config[info_key][instance.package_name + route_id] = grunt_info[info_key];
					}
				);
			}
		);
	}
);

module.exports = function(grunt) {
	grunt.initConfig(grunt_config);
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-copy');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-less');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-cssmin');
	grunt.loadNpmTasks('grunt-text-replace');
	grunt.loadNpmTasks('grunt-react');
	grunt.registerTask('default', ['watch']);
	var build_tasks = [];
	_.each(['clean','copy','less','react', 'concat'], function(key) {
		if (grunt_config[key]) {
			build_tasks.push(key);
		}
	});	
	grunt.registerTask('build', build_tasks);	
};
