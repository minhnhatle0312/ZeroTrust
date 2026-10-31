const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function createAudit(file) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Fail at startup when the audit file cannot be opened.
  fs.closeSync(fs.openSync(file, "a", 0o600));
  function middleware(req, res, next) {
    const requestId = randomUUID();
    res.setHeader("X-Request-Id", requestId);
    res.setHeader("Cache-Control", "no-store");
    const sendJson = res.json.bind(res);
    res.json = (body) => {
      const event = {
        timestamp: new Date().toISOString(), requestId,
        username: req.user?.preferred_username || "anonymous",
        roles: (req.roles || []).filter((r) => ["admin", "manager", "employee", "auditor"].includes(r)),
        method: req.method, path: (req.baseUrl + req.path).slice(0, 256),
        httpStatus: res.statusCode, decision: res.statusCode < 400 ? "ALLOW" : "DENY",
        reason: req.auditReason || (res.statusCode < 400 ? "AUTHORIZED" : "REQUEST_REJECTED"),
      };
      try {
        // Log only explicit fields. Never record headers, tokens, passwords or bodies.
        fs.appendFileSync(file, JSON.stringify(event) + "\n", { encoding: "utf8", mode: 0o600 });
      } catch {
        console.error("Audit write failed; request denied");
        res.statusCode = 503;
        return sendJson({ status: "DENY", message: "Audit storage unavailable", requestId });
      }
      return sendJson({ ...body, requestId });
    };
    next();
  }
  function recent(limit = 20) {
    // Read a bounded tail, keeping memory use independent of the total file size.
    const fd = fs.openSync(file, "r");
    try {
      const size = fs.fstatSync(fd).size;
      const start = Math.max(0, size - 256 * 1024);
      const buffer = Buffer.alloc(size - start);
      fs.readSync(fd, buffer, 0, buffer.length, start);
      const lines = buffer.toString("utf8").split("\n");
      if (start > 0) lines.shift();
      return lines.filter(Boolean).slice(-limit).map((line) => JSON.parse(line)).reverse();
    } finally {
      fs.closeSync(fd);
    }
  }
  return { middleware, recent };
}

module.exports = { createAudit };
