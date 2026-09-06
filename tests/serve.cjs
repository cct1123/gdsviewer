// Optional development helper; the viewer does not require a server.
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const assets = new Map([
  ["index.html", "text/html; charset=utf-8"],
  ["gds_parser.js", "application/javascript; charset=utf-8"],
  ["gds_viewer.js", "application/javascript; charset=utf-8"],
  ["vendor/pixi.min.js", "application/javascript; charset=utf-8"],
  ["tests/browser.html", "text/html; charset=utf-8"],
  ["tests/browser-smoke.js", "application/javascript; charset=utf-8"],
]);
for (const name of fs.readdirSync(path.join(__dirname, "fixtures"))) {
  if (name.endsWith(".gds")) assets.set(`tests/fixtures/${name}`, "application/octet-stream");
}

function createStaticServer() {
  return http.createServer((request, response) => {
    if (request.method !== "GET") {
      response.writeHead(405).end();
      return;
    }
    const pathname = new URL(request.url, "http://localhost").pathname;
    // A nested mount verifies relative script URLs as well as root hosting.
    const asset = pathname.replace(/^\/(?:viewer\/)?/, "") || "index.html";
    if (!assets.has(asset)) {
      response.writeHead(404).end("Not found");
      return;
    }
    const headers = { "Content-Type": assets.get(asset), "Cache-Control": "no-store" };
    if (asset === "index.html") headers["Content-Security-Policy"] = "connect-src 'none'";
    response.writeHead(200, headers);
    response.end(fs.readFileSync(path.join(__dirname, "..", asset)));
  });
}

if (require.main === module) {
  const server = createStaticServer();
  server.listen(0, "127.0.0.1", () => {
    console.log(`Static test viewer: http://127.0.0.1:${server.address().port}/viewer/`);
    console.log(`Browser checks: http://127.0.0.1:${server.address().port}/tests/browser.html`);
  });
}

module.exports = { createStaticServer };
