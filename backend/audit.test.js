const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createAudit } = require("./audit");

function run(audit, status, user = undefined) {
  let body;
  const req = { method: "GET", baseUrl: "", path: "/api/admin", user,
                roles: ["admin"], headers: { authorization: "Bearer NEVER_LOG_THIS" },
                body: { password: "NEVER_LOG_PASSWORD" } };
  const res = { statusCode: status, setHeader() {}, json(value) { body = value; return value; } };
  audit.middleware(req, res, () => {});
  res.json({ status: status === 200 ? "ALLOW" : "DENY" });
  return { body, status: res.statusCode };
}

test("audit stores allow/deny across instances, excludes credentials and caps tail", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iam-audit-"));
  try {
    const file = path.join(dir, "events.jsonl");
    const audit = createAudit(file);
    const allowed = run(audit, 200, { preferred_username: "admin01" });
    run(audit, 401);
    const reopened = createAudit(file);
    assert.equal(reopened.recent(1).length, 1);
    assert.equal(reopened.recent(1)[0].decision, "DENY");
    assert.equal(reopened.recent(1)[0].username, "anonymous");
    const events = reopened.recent(2);
    assert.equal(events[1].decision, "ALLOW");
    assert.equal(events[1].requestId, allowed.body.requestId);
    const text = fs.readFileSync(file, "utf8");
    assert.ok(!text.includes("NEVER_LOG"));
    assert.ok(!text.includes("authorization"));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("audit write failure returns 503 instead of an ALLOW response", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "iam-audit-"));
  try {
    const file = path.join(dir, "events.jsonl");
    const audit = createAudit(file);
    fs.unlinkSync(file);
    fs.mkdirSync(file);
    const result = run(audit, 200, { preferred_username: "admin01" });
    assert.equal(result.status, 503);
    assert.equal(result.body.status, "DENY");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
