var Alarm = require('./alarm');
var CaptureHttp = require('./captureHttp');
var Heap = require('heap');

var geoip = require('geoip-lite');
var ui = require('./ui');
var url = require('url');

var ALARM_INTERVAL = 120000;
var TOP_X_INTERVAL = 10000;

var ALARM_TRIGGER_VALUE = 10;
var TOP_X_SITES = 10;
var TOP_X_PAGES = 10;

var alarm;
var capture;

var geoLookup = {};
var sites = {};
var pagesPerSite = {};
var topInterval;

function compare(a, b) {
  return b.value - a.value;
}

function onAlarmTriggered(message) {
  ui.addMessage(message);
}

function onAlarmResolved(message) {
  ui.addMessage(message);
}

function outputTop() {
  var currentSites = sites;
  var currentPages = pagesPerSite;
  sites = {};
  pagesPerSite = {};

  // calculate the top websites
  var websiteHeap = new Heap(compare);
  Object.keys(currentSites).forEach(function(key) {
    websiteHeap.push(currentSites[key]);
    alarm.update(key, currentSites[key].value);
  });

  var topSites = [];
  for (var i = 0, siteLength = websiteHeap.size(); i < TOP_X_SITES && i < siteLength; i++) {
    var site = websiteHeap.pop();
    topSites.push(site);

    // calculate the top pages in the site
    var pages = currentPages[site.key] || {};
    var pagesHeap = new Heap(compare);
    Object.keys(pages).forEach(function(key) { pagesHeap.push(pages[key]); });
    site.pages = [];
    for (var j = 0, pageLength = pagesHeap.size(); j < TOP_X_PAGES && j < pageLength; j++) {
      var page = pagesHeap.pop();
      site.pages.push(page);
    }
    pagesHeap = null;
  }

  currentSites = null;
  currentPages = null;
  websiteHeap = null;

  ui.setTopSites(topSites);
  ui.setMap(topSites);
}

function onResponse(session, request, response) {
  // TODO: analyze HTTP response codes
}

function onRequest(session, request) {
  var headers = request && request.headers || {};
  var host = headers.Host;
  var pageUrl = url.parse(request.url);

  // simple attempt to skip files, we want pages
  var hasExtension = pageUrl.pathname.match(/\.[a-z]{1,5}$/i);
  if (hasExtension) {
    return;
  }

  // grab geoip data
  var src = session && session.tcp_session && session.tcp_session.src && session.tcp_session.src.split(':')[0];
  var dest = session && session.tcp_session && session.tcp_session.dst && session.tcp_session.dst.split(':')[0];

  // track top sites
  var page = pageUrl.pathname.split('/')[1] || '/';
  if (page[0] !== '/') {
    page[0] = '/' + page[0];
  }

  var site = sites[host];
  if (!site) {
    site = {key:host, value:0, src: {}, dest: {}};
    sites[host] = site;
  }
  site.value += 1;

  if (dest && (!(dest in site.dest))) {
    if (!(src in geoLookup)) {
      var slookup = geoip.lookup(dest);
      if (slookup) {
        geoLookup[dest] = slookup;
        site.dest[dest] = slookup;
      }
    }
  }
  if (src && (!(src in site.src))) {
    if (!(src in geoLookup)) {
      var dlookup = geoip.lookup(src);
      if (dlookup) {
        geoLookup[src] = dlookup;
        site.src[src] = dlookup;
      }
    }
  }

  // track top pages
  if (!pagesPerSite[host]) {
    pagesPerSite[host] = {};
  }

  if (!pagesPerSite[host][page]) {
    pagesPerSite[host][page] = {key:page, value:0};
  }
  else {
    pagesPerSite[host][page].value += 1;
  }
}

function onStart(interface, filter) {
  ui.addMessage('.. Listening on ' + this.session.device_name);
  ui.addMessage('.. Using filter ' + filter);
}

function start(interface) {
  ui.render();

  capture = new CaptureHttp(interface);
  capture.on('request', onRequest);
  capture.on('response', onResponse);
  capture.on('start', onStart);
  capture.start();

  alarm = new Alarm();
  alarm.on('triggered', onAlarmTriggered);
  alarm.on('resolved', onAlarmResolved);
  alarm.start(ALARM_INTERVAL, TOP_X_INTERVAL, ALARM_TRIGGER_VALUE);

  topInterval = setInterval(outputTop, TOP_X_INTERVAL);
}

function stop() {
  if (topInterval) {
    clearInterval(topInterval);
  }

  if (alarm) {
    alarm.stop();
    alarm.removeListener('triggered', onAlarmTriggered);
    alarm.removeListener('resolved', onAlarmResolved);
  }

  if (capture) {
    capture.stop();
    capture.removeListener('request', onRequest);
    capture.removeListener('response', onResponse);
    capture.removeListener('start', onStart);
  }
}

module.exports = {
  start:start,
  stop: stop
};
