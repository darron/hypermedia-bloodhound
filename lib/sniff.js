var CaptureHttp = require('./captureHttp');
var log = require('verbalize');

var capture;

function onRequest(session, request) {
	console.log(
        " #" + session.request_count +
        " HTTP " + request.http_version +
        " request: " + request.method + " " + request.url);
}

function onStart(interface, filter) {
	log.writeln('.. Listening on ' + this.session.device_name);
	log.writeln('.. Using filter ' + filter);
}

function start(interface) {
	capture = new CaptureHttp(interface);
	capture.on('request', onRequest);
	capture.on('start', onStart);
	capture.start();
}

function stop() {
	capture.stop();
	capture.removeListener('request', onRequest);
	capture.removeListener('start', onStart);
}

module.exports = {
	start:start,
	stop: stop
};
