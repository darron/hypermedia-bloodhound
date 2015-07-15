var CaptureHttp = require('./captureHttp');
var Heap = require('heap');
var log = require('verbalize');
var url = require('url');

var TOP_X_SITES = 10;
var TOP_X_PAGES = 10;
var TOP_X_INTERVAL = 10000;

var capture;
var sites = {};
var pagesPerSite = {};
var topInterval;

function compare(a,b) {
  return b.value - a.value;
}

function outputTop() {
  var currentSites = sites;
  var currentPages = pagesPerSite;
  sites = {};
  pagesPerSite = {};

  // calculate the top websites
  var websiteHeap = new Heap(compare);
  Object.keys(currentSites).forEach(function(key) { websiteHeap.push(currentSites[key]); });

  var topSites = [];
  for (var i = 0, siteLength = websiteHeap.size(); i < TOP_X_SITES && i < siteLength; i++) {
    var site = websiteHeap.pop();
    console.log(site);
    topSites.push(site);

    // calculate the top pages in the site
    var pages = currentPages[site.host] || {};
    var pagesHeap = new Heap(compare);
    Object.keys(pages).forEach(function(key) { pagesHeap.push(pages[key]); });
    site.pages = [];
    for(var j = 0, pageLength = pagesHeap.size(); j < TOP_X_PAGES && j < pageLength; j++) {
      var page = pagesHeap.pop();
      site.pages.push(page);
    }
    pagesHeap = null;
  }

  currentSites = null;
  currentPages = null;
  websiteHeap = null;

  console.log(topSites);
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

  // track top sites
  var page = pageUrl.pathname.split('/')[1] || '/';
  if (!sites[host]) {
    sites[host] = {host:host, count:1};
  }
  else {
    sites[host].count += 1;
  }

  // track top pages
  if (!pagesPerSite[host]) {
    pagesPerSite[host] = {};
  }

  if (!pagesPerSite[host][page]) {
    pagesPerSite[host][page] = {page:page, count:0};
  }
  else {
    pagesPerSite[host][page].count += 1;
  }
}

function onStart(interface, filter) {
  log.writeln('.. Listening on ' + this.session.device_name);
  log.writeln('.. Using filter ' + filter);
}

function start(interface) {
  capture = new CaptureHttp(interface);
  capture.on('request', onRequest);
  capture.on('response', onResponse);
  capture.on('start', onStart);
  capture.start();

  topInterval = setInterval(outputTop, TOP_X_INTERVAL);
}

function stop() {
  if (topInterval) {
    clearInterval(topInterval);
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
