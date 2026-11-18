// Test-only preloader: never loaded by either application or server.js.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const sandbox = process.env.IAM_TEST_ROOT;
if (!sandbox) throw Error('Use scripts/test_phase1.py for isolated tests');
const root = fs.realpathSync(sandbox);
const within = value => {
  const relative = path.relative(root, path.resolve(String(value)));
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};
const sqlite = require('node:sqlite');
const Database = sqlite.DatabaseSync;
sqlite.DatabaseSync = class extends Database {
  constructor(filename, ...args) {
    if (filename !== ':memory:' && !within(filename)) throw Error('Test database must stay in temporary test root');
    if (filename !== ':memory:') {
      let parent = path.resolve(String(filename));
      while (!fs.existsSync(parent)) parent = path.dirname(parent);
      if (!within(fs.realpathSync(parent))) throw Error('Test database cannot follow an external link');
    }
    super(filename, ...args);
  }
};
const load = Module._load;
Module._load = function (name, ...args) {
  if (name === 'dotenv' || name.startsWith('dotenv/')) throw Error('Live environment loading is disabled in isolated tests');
  return load.call(this, name, ...args);
};
const allowedHost = host => ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(host).toLowerCase());
const net = require('node:net');
const ports = new Set();
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function (...args) {
  const options = args[0];
  const port = options && typeof options === 'object' ? options.port : options;
  const host = options && typeof options === 'object' ? options.host : args[1];
  if (port !== 0 || !allowedHost(host)) throw Error('Tests may listen only on an ephemeral loopback port');
  let allocated;
  this.once('listening', () => {allocated = this.address().port;ports.add(allocated);});
  this.once('close', () => ports.delete(allocated));
  return listen.apply(this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!allowedHost(url.hostname) || !ports.has(Number(url.port))) throw Error('Only this test process fake servers may receive fetch requests');
  return originalFetch(input, options);
};
// Block direct sockets as well as fetch; local fake HTTP servers remain usable.
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  let options = args[0];
  if (Array.isArray(options)) options = options[0];
  const host = options && typeof options === 'object' ? options.host : typeof args[1] === 'string' ? args[1] : 'localhost';
  const port = options && typeof options === 'object' ? Number(options.port) : Number(options);
  if (options?.path || !allowedHost(host || 'localhost') || !ports.has(port)) throw Error('Only test-owned loopback sockets are permitted');
  return connect.apply(this, args);
};
