#!/usr/bin/env node
// A tiny local web server for trying the site: `npm start`, then open http://localhost:8000
//
// Why not just double-click index.html? Browsers block ES modules, fetch() and the
// two-window sync (BroadcastChannel) on file:// pages. This server needs nothing
// installed and works with Wi-Fi off.
//
// Options: PORT=9000 npm start   (PowerShell: $env:PORT=9000; npm start)

import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { REPO_ROOT } from "./lib/content-files.js";

const port = Number(process.env.PORT) || 8000;

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".ico": "image/x-icon"
};

const server = createServer(async (request, response) => {
  try {
    const requestedPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    let filePath = path.normalize(path.join(REPO_ROOT, requestedPath));
    // Refuse anything that tries to climb out of the project folder (e.g. /../../secret).
    if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + path.sep)) { response.writeHead(403).end("Forbidden"); return; }
    if ((await stat(filePath)).isDirectory()) filePath = path.join(filePath, "index.html");
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-store" // so edits show up on the next refresh
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(port, () => {
  console.log(`Military Heritage site running at http://localhost:${port}`);
  console.log("Press Ctrl+C to stop.");
});
