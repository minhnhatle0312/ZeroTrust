const {test} = require('node:test');
const assert = require('node:assert/strict');
const {DatabaseSync} = require('node:sqlite');
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const net = require('node:net');

test('isolation rejects database paths outside the test root before opening', () => {
  const nonexistent = path.resolve(process.env.IAM_TEST_ROOT, '..', 'must-not-exist.sqlite');
  assert.equal(fs.existsSync(nonexistent), false);
  assert.throws(() => new DatabaseSync(nonexistent), /temporary test root/);
  assert.equal(fs.existsSync(nonexistent), false);
});
test('isolation permits a temporary database and memory database', () => {
  for (const file of [':memory:', path.join(process.env.IAM_TEST_ROOT, 'guard-fixture.sqlite')]) {
    const db = new DatabaseSync(file);
    db.exec('CREATE TABLE fixture (id INTEGER)');
    db.close();
  }
});
test('isolation blocks environment loader', () => {
  assert.throws(() => require('dotenv'), /environment loading is disabled/);
});
test('isolation blocks live loopback and remote fetch before network access', () => {
  assert.throws(() => fetch('http://127.0.0.1:3001/health'), /fake servers/);
  assert.throws(() => fetch('https://example.invalid/'), /fake servers/);
});
test('isolation blocks direct socket to a non-test port', () => {
  const socket = new net.Socket();
  try {assert.throws(() => socket.connect(3001, '127.0.0.1'), /test-owned/);}
  finally {socket.destroy();}
});
test('isolation blocks listening on fixed ports', () => {
  const server = http.createServer();
  assert.throws(() => server.listen(3001, '127.0.0.1'), /ephemeral loopback/);
});
test('isolation permits only the test own ephemeral fake HTTP server', async () => {
  const server = http.createServer((_req,res) => res.end('synthetic fixture'));
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const response = await fetch('http://127.0.0.1:' + server.address().port);
    assert.equal(await response.text(), 'synthetic fixture');
  } finally {await new Promise(resolve => server.close(resolve));}
});
