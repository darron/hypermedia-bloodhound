var EventEmitter = require("events").EventEmitter;
var Heap = require('heap');
var format = require('util').format;
var inherits = require("util").inherits;

function Alarm() {

  this.active = {};
  this.average = {};
  this.interval = null;
  this.numberOfActive = 0;
  this.trigger = null;
  this.window = null;

  var self = this;

  this.compare = function(a,b) {
    return b.value - a.value;
  };

  this.rollingAverage = function(average, newValue, count) {
    average -= average / count;
    average += newValue / count;
    return average;
  };

  this.triggerAlarm = function(site, now) {
    self.numberOfActive++;
    self.active[site.key] = site;
    self.emit(
      'triggered',
      format('High traffic generated an alert for %s - hits = %d, triggered at %s', site.key, site.value, now),
      site.key,
      site.value);
  };

  this.resolveAlarm = function(site, now) {
    self.numberOfActive--;
    delete self.active[site.key];
    self.emit(
      'resolved',
      format('Traffic has returned to normal for site %s at %s', site.key, now),
      site.key,
      site.value);
  };

  this.checkAlarm = function() {
    var now = new Date();
    var current = self.average;
    self.average = {};

    var averageHeap = new Heap(self.compare);
    Object.keys(current).forEach(function(key) { averageHeap.push(current[key]); });

    for (var i = 0, length = averageHeap.size(); i < length; i++) {
      var site = averageHeap.pop();
      var isCurrentlyAlarmed = self.isActive(site.key);

      if (site.value < self.trigger && !self.hasActiveAlarms()) {
        console.log('no alarms');
        break;
      } else if (site.value < self.trigger && isCurrentlyAlarmed) {
        self.resolveAlarm(site, now);
      } else if (site.value >= self.trigger && !isCurrentlyAlarmed) {
        self.triggerAlarm(site, now);
      }
    }

    // if we did not receive any data from a site, then clear its alarm
    if (self.hasActiveAlarms()) {
      Object.keys(self.active).forEach(function(site) {
        if (!(current[site])) {
          self.resolveAlarm(self.active[site], now);
        }
      });
    }
  };
  EventEmitter.call(this);
}
inherits(Alarm, EventEmitter);

Alarm.prototype.start = function(alarmIntervalValue, collectionIntervalValue, triggerValue) {
  this.alarmInterval = alarmIntervalValue;
  this.collectionInterval = collectionIntervalValue;
  this.trigger = triggerValue;
  this.window = alarmIntervalValue / collectionIntervalValue;
  this.interval = setInterval(this.checkAlarm, this.alarmInterval);
};

Alarm.prototype.stop = function() {
  if (this.interval) {
    clearInterval(this.interval);
  }
};

Alarm.prototype.average = function(site) {
  return this.average[site];
};

Alarm.prototype.hasActiveAlarms = function() {
  return this.numberOfActive > 0;
};

Alarm.prototype.isActive = function(site) {
  return (site in this.active);
};

Alarm.prototype.update = function(site, value) {
  if (!this.average[site]) {
    this.average[site] = { key: site, value: 0};
  }
  this.average[site].value = this.rollingAverage(this.average[site].value || 0, value || 0, this.window);
};

module.exports = Alarm;
