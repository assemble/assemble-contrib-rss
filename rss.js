var path = require('path');
var path = require('path');
var url = require('url');
var fs = require('fs');
var chalk = require('chalk');
var moment = require('moment');
var async = require('async');
var rss = require('rss');
var _ = require('lodash');
var utils = require('./lib/utils');

module.exports = function (config, callback) {

  'use strict';

  var pkg = require(path.join(process.cwd(), 'package.json'));
  
  var options = config.context;
  var config = options.rss || {};
  
  var pages = options.pages; // Define an array all of page data.
  var page = options.page; // Define a single page's data object.
  
  // Skip over the plugin if it isn't defined in the options.
  if (!_.isUndefined(config)) {

    /**
     * @function fail
     * @param {string} 'property' - The undefined property.
     * @desc Stops Grunt with a fatal failure.
     */
    var fail = function (property) {
      if (config.logging) {
        /**
         * @function message
         * @param 'cb' - A callback to run after the message is logged.
         * @desc Log a message to the console and kill Assemble.
         */
        var message = function (cb) {
          console.log('RSS property ' + 
                      chalk.yellow(property) + 
                      ' is not defined ' + 
                      chalk.red('ERROR')); 
          cb();
        };
        
        // Show the message and kill Grunt/gulp.
        return message(function () {
          process.kill();
        });
      } else return;
    };
    
    /** 
     * If package.json has an author string instead of an author object, 
     * split the string so the data can be used in templates.
     * 
     * For example, we need to turn: 
     * `"author": "Name <email> (url)"` into
     * `"author": { "name": "name", "email": "email", "url": "url" }`
     */
    if (typeof pkg.author === 'string') {

      // Split the string into an array.
      var array = pkg.author.split(/<|>/);

      // Clean up the name and URL strings, but only if they exist.
      if (array[0]) {
        array[0] = array[0].slice(0, -1);
      } else if (array[2]) {
        array[2] = array[2].substr(2).slice(0, -1); 
      };

      // Create the new author object
      var author = {
        name: array[0],
        email: array[1],
        url: array[2]
      };

      // Update the pkg (package.json) object
      pkg.author = author; 
    };
    
    /**
     * @object defaults
     * @desc Set default values for the RSS feed data.
     */
    var defaults = {
      title: pkg.name,
      author: pkg.author.name,
      description: pkg.description,
      copyright: 'Copyright ' + moment().format("YYYY") + ' ' + pkg.author.name,
      generator: 'Generated by Assemble.js.',
      lastBuildDate: moment().format("dddd, MMMM Do YYYY"),
      pubdate: moment().format(),
      siteurl: pkg.homepage,
      feedurl: url.resolve(pkg.homepage, config.dest || 'feed.xml'),
      language: 'en',
      ttl: '60',
      geoRSS: false,
    };
       
    moment.lang(config.language || defaults.language);  // Moment.js default language
    
    /**
     * @function feed
     * @desc Generate the feed using the rss module. 
     *       The idea here is to check is a property is defined in 
     *       the plugin configuration. If it is not, pull it from the
     *       defaults object (which is defined above). In some cases where a 
     *       a required property is not specified in the config and the
     *       default will not solve that issue, the `fail()` function will
     *       be called, thus stoping the task.
     */
    var feed = new rss({
      generator: config.generator || defaults.generator,
      lastBuildDate: defaults.lastBuildDate,
      title: config.title || defaults.title || fail('title'),
      description: config.description || defaults.description,
      pubdate: config.pubdate || defaults.pubdate,
      site_url: config.siteurl || defaults.siteurl,
      feed_url: config.feedurl || defaults.feedurl,
      image_url: config.imageurl,
      author: config.author || defaults.author || fail('author'),
      managingEditor: config.managingEditor,
      webMaster: config.webMaster,
      categories: config.categories,
      docs: config.docs,
      copyright: config.copyright || defaults.copyright,
      language: config.language || defaults.language,
      ttl: config.ttl || defaults.ttl,
      geoRSS: config.geoRSS || defaults.geoRSS
    });
    
    /**
     * @function addItem
     * @param {object} 'itemData'
     * @desc Add an item to the RSS feed.
     */
    var addItem = function (itemData) {
      feed.item(itemData);
    };
       
    async.eachSeries(pages, function (file, next) {
      
      var page = file.data;
          
      /**
       * @object defaults.item
       * @desc Sets default values for each item in the RSS feed.
       */
      defaults.item = {
        title: page.title || fail('title'),
        author: defaults.author || page.author || fail('author'),
        description: page.description,
        url: page.url || url.resolve(pkg.homepage, file.dest), 
        guid: page.guid || page.url, 
        categories: page.categories,
        lat: page.lat, 
        long: page.long
      };
      
      addItem(defaults.item);
      
      next();
    }, function (err) {
      callback();
    });
        
    var output = feed.xml(); // cache the XML output to a variable
    if (config.format === true) output = utils.format(output); // format XML if true
  
    /** 
     * I could use `grunt.file.write()` but I am trying to future 
     * proof this middleware for versions of assemble that don't depend on 
     * grunt.
     */
    fs.writeFileSync(path.join(__dirname,'feed.xml'), output);
    //console.log('RSS feed generated in ' /*+ dest.replace(/\\/g, '/')*/ + ' OK'.green);    
        
  };
};
