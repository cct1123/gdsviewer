// Optional benchmark server: node tests/performance/serve.cjs <baseline-checkout>
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const root = path.resolve(__dirname, "../..");
const baseline = path.resolve(process.argv[2] || root);
const server = http.createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const before = url.pathname.startsWith("/baseline/");
  const base = before ? baseline : root;
  const name = url.pathname.replace(before ? /^\/baseline\// : /^\//, "") || "index.html";
  if (request.method !== "GET" || !/^(index\.html|gds_parser\.js|gds_viewer\.js|viewer_theme\.js|liquid_glass\.js|vendor\/pixi\.min\.js|tests\/(browser\.html|browser-smoke\.js|fixtures\/[\w-]+\.gds|performance\/(index\.html|run\.js|fixtures\.js)))$/.test(name)) {
    response.writeHead(404).end(); return;
  }
  const filename = path.join(base, name);
  if (!fs.existsSync(filename)) { response.writeHead(404).end(); return; }
  response.writeHead(200, { "Content-Type": name.endsWith(".html") ? "text/html" : name.endsWith(".js") ? "application/javascript" : "application/octet-stream", "Cache-Control": "no-store",
    "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp" });
  response.end(fs.readFileSync(filename));
});
server.listen(0, "127.0.0.1", () => console.log(`Benchmarks: http://127.0.0.1:${server.address().port}/tests/performance/index.html`));
