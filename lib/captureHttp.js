var EventEmitter = require('events').EventEmitter;
var HttpSession = require('./httpSession');
var inherits = require('util').inherits;

var pcap = require('pcap');

// Default pcap filter
// Select all IPv4 HTTP packets to and from port 80
// only packets that contain data, skip SYN and FIN packets and ACK-only packets.
//var DEFAULT_FILTER = 'tcp port 80 and (((ip[2:2] - ((ip[0]&0xf)<<2)) - ((tcp[12]&0xf0)>>2)) != 0)';
var DEFAULT_FILTER = 'ip proto \\tcp';

/*
  Specifically designed to capture a subset of TCP traffic, only HTTP
*/
function CaptureHttp(interface) {
  this.interface = interface;
  this.session = null;
  this.tracker = null;

  var self = this;

  this.onProcessPacket = function(rawPacket) {
    var packet = pcap.decode.packet(rawPacket);
    self.tracker.track_packet(packet);
  };

  this.onTrackerSession = function(tcpSession) {
    var httpSession = new HttpSession(tcpSession);

    // TODO: support errors
    // httpSession.on('http error', function (session, direction, error) {
    // });

    httpSession.on('http request', function (session) {
      var request = session.request;
      self.emit('request', session, request);
    });
  };

  EventEmitter.call(this);
}
inherits(CaptureHttp, EventEmitter);

CaptureHttp.prototype.stop = function() {
  this.emit('stop');

  if (!this.session) {
    return;
  }

  this.emit('stats', this.session.stats());
  this.tracker.removeListener('session', this.onTrackerSession);
  this.tracker = null;

  this.session.removeListener('packet', this.onProcessPacket);
  this.session.close();
  this.session = null;
};

CaptureHttp.prototype.start = function(interface, filter) {

  filter = filter || DEFAULT_FILTER;

  this.session = pcap.createSession(interface, filter);
  this.session.on('packet', this.onProcessPacket);

  this.tracker = new pcap.TCPTracker();
  this.tracker.on('session', this.onTrackerSession);

  this.emit('start', this.session.device_name, filter);
};

module.exports = CaptureHttp;
