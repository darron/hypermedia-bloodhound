var CaptureHttp = require('./captureHttp');
var Heap = require('heap');
var log = require('verbalize');
var url = require('url');

var ALARM_INTERVAL = 10000;
var TOP_X_INTERVAL = 5000;

var MOVING_AVERAGE_WINDOW = ALARM_INTERVAL/TOP_X_INTERVAL;
var ALARM_VALUE = 10; // alarm if we get more than 10
var TOP_X_SITES = 10;
var TOP_X_PAGES = 10;

var capture;
var siteAverage = {};
var siteAlarmed = {};
var activeAlarms = 0;

var sites = {};
var pagesPerSite = {};
var alarmInterval;
var topInterval;

function rollingAverage(average, newValue, count) {
  average -= average / count;
  average += newValue / count;
  return average;
}

function compare(a,b) {
  return b.value - a.value;
}

function outputAlarm() {
  var now = new Date();
  var currentAverage = siteAverage;
  siteAverage = {};
  console.log(currentAverage);

  var averageHeap = new Heap(compare);
  Object.keys(currentAverage).forEach(function(key) { averageHeap.push(currentAverage[key]); });

  for (var i = 0, averageLength = averageHeap.size(); i < averageLength; i++) {
    var average = averageHeap.pop();
    var isCurrentlyAlarmed = siteAlarmed[average.key] === true;

    if (average.value < ALARM_VALUE && activeAlarms === 0) {
      break;
    } else if (average.value < ALARM_VALUE && isCurrentlyAlarmed) {
      activeAlarms--;
      siteAlarmed[average.key] = false;
      console.log('Traffic has returned to normal for site %s at %s', average.key, now);
    } else if (average.value >= ALARM_VALUE && !isCurrentlyAlarmed) {
      activeAlarms++;
      siteAlarmed[average.key] = true;
      console.log('High traffic generated an alert for %s - hits = %d, triggered at %s', average.key, average.value, now);
    }
  }
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
    if (!siteAverage[key]) {
      siteAverage[key] = { key: key, value: 0};
    }
    siteAverage[key].value = rollingAverage(siteAverage[key].value || 0, currentSites[key].value || 0, MOVING_AVERAGE_WINDOW);
  });

  var topSites = [];
  for (var i = 0, siteLength = websiteHeap.size(); i < TOP_X_SITES && i < siteLength; i++) {
    var site = websiteHeap.pop();
    console.log(site);
    topSites.push(site);

    // calculate the top pages in the site
    var pages = currentPages[site.key] || {};
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
    sites[host] = {key:host, value:1};
  }
  else {
    sites[host].value += 1;
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
  log.writeln('.. Listening on ' + this.session.device_name);
  log.writeln('.. Using filter ' + filter);
}

function start(interface) {
  capture = new CaptureHttp(interface);
  capture.on('request', onRequest);
  capture.on('response', onResponse);
  capture.on('start', onStart);
  capture.start();

  alarmInterval = setInterval(outputAlarm, ALARM_INTERVAL);
  topInterval = setInterval(outputTop, TOP_X_INTERVAL);
}

function stop() {
  if (alarmInterval) {
    clearInterval(alarmInterval);
  }
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
