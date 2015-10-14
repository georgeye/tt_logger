var winston = require('winston');
var fs = require('fs'),
util = require('util'),
os = require('os');
var logLevel = 5;
var Protobuf = require('node-protobuf');
var dgram = require("dgram");
var PopcornMsg = new Protobuf(fs.readFileSync(getPath(__filename) + 'popcorn.desc'));
// The "PopcornMsg" message.


var Popcorn = function(options) {
  winston.Transport.call(this, options);
  this.name = 'popcon_transport';
  options = options || {};
  this.level = options.level || 'error';
  this.host = options.host || '127.0.0.1';
  this.port = options.port || 9125;
  this.node = options.service + '@' + os.hostname();
  this.node_role = options.node_role || "no_role";
  this.node_version = options.node_version || "no_version";
  var sock = dgram.createSocket("udp4");
  this.sock = sock;
};
util.inherits(Popcorn, winston.Transport);
winston.transports.Popcorn = Popcorn;
Popcorn.prototype.send = function(msg) {
  var buffer = new Buffer(msg);
  this.sock.send(buffer, 0, buffer.length, this.port, this.host);
};

Popcorn.prototype.log = function (level, msg, meta, callback) {
  //
  // Store this message and metadata, maybe use some custom logic
  // then callback indicating success.
  //
  Msg = {packetV: 1, node: this.node, node_role: this.node_role, node_version: this.node_version,
         level: get_popcorn_level(level), message: msg};
  if(meta && meta.module) Msg.module = meta.module;
  if(meta && meta.funcName) Msg.funcName = meta.funcName;
  if(meta && meta.line) Msg.line = meta.line;
  if(meta && meta.pid) Msg.pid = meta.pid;
  var raw = PopcornMsg.serialize(Msg, "popcornMsg.PopcornMsg");
  this.send(raw);
  callback(null, true);
};

function getPath(fileName) {
  var index = fileName.lastIndexOf('/');
  var path = fileName.substr(0, index+1);
  return path;
}
/*
129 lager_severity_to_mask(debug)     -> 128;
130 lager_severity_to_mask(info)      -> 64;
131 lager_severity_to_mask(notice)    -> 32;
132 lager_severity_to_mask(warn)      -> 16;
133 lager_severity_to_mask(error)     -> 8;
134 lager_severity_to_mask(critical)  -> 4;
135 lager_severity_to_mask(alert)     -> 2;
136 lager_severity_to_mask(emergency) -> 1;
137 lager_severity_to_mask(none)      -> 0.
*/

function get_popcorn_level(level) {
  if(level == "error") return 8;
  else if(level == "debug") return 128;
  else if(level == "warn") return 16;
  else return 64;
}

exports.initLog = function(name, logLevel_, popcornHost, popcornPort, nodeRole, nodeVersion) {
  var serviceName = module.parent.filename;
  var index = serviceName.lastIndexOf('/');
  if(index > 0) {
    serviceName = serviceName.slice(0, index);
    var p = serviceName.lastIndexOf('/')
    if(p > 0) serviceName = serviceName.slice(p+1);
  }
  var options = {'level': 'info', 'service': serviceName, 'host': popcornHost, 'port': popcornPort, 'node_role':
  nodeRole, 'node_version': nodeVersion};
  winston.add(winston.transports.File, { filename: name, maxsize: 5000000, maxFiles: 10});
  winston.add(winston.transports.Popcorn , options);
  winston.remove(winston.transports.Console);
  logLevel = logLevel_;
}
exports.logInfo = function(log) {
  if(logLevel >= 4) {
    var current = new Date();
    var meta = get_meta();
    winston.log('info', current + '  ' + log, meta);
  }
}

exports.logDebug = function(log) {
  if(logLevel >=5) {
    var current = new Date();
    var meta = get_meta();
    winston.log('debug', current + '  ' + log, meta);
  }
}

exports.logWarn = function(log) {
  if(logLevel >= 3) {
    var current = new Date();
    var meta = get_meta();
    winston.log('warn', current + '  ' + log, meta);
  }
}

exports.logError = function(log, Meta) {
  if(logLevel >= 2) {
    var current = new Date();
    if(Meta) winston.log('error', current + '  ' + log, Meta);
    else {
      var meta = get_meta();
      winston.log('error', current + '  ' + log, meta);
    }
  }
}

function get_meta() {
  var data ={};
  data.path = data.line = data.pos = data.file = '';
  data.method = "main";
  data.stack = (new Error()).stack.split('\n').slice(3);
  // Stack trace format :
  // http://code.google.com/p/v8/wiki/JavaScriptStackTraceApi
  var s = data.stack[0], sp = /at\s+(.*)\s+\((.*):(\d*):(\d*)\)/gi.exec(s)
      || /at\s+()(.*):(\d*):(\d*)/gi.exec(s);
  if (sp && sp.length === 5) {
    if(sp[1]) data.method = sp[1];
    data.path = sp[2];
    data.line = sp[3];
    data.pos = sp[4];
    var paths = data.path.split('/');
    data.file = paths[paths.length - 1];
  }
  var meta = {pid: process.pid, module: data.file,
                funcName: data.method, line: data.line};
  return meta;
}

process.on('uncaughtException', function (err) {
  exports.logError('uncaughtException, err msg:' + err.message + ' stack:' + err.stack,
                  {pid: process.pid, module: 'tt_logger', funcName: 'uncaughtException', line: 64});
  setTimeout(function() {process.exit(1);}, 2000); // exit with failure
});
