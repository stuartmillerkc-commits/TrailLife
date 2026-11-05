// The projector window must not load lesson content: it only draws snapshots the leader
// sends. This test follows every `import` from src/views/display-view.js and fails if
// the content loader (or any file that could read /content) is reachable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../scripts/lib/content-files.js";

const IMPORT_PATTERN = /^\s*import\s+[^;]*?from\s+"([^"]+)";/gm;

function importGraph(entryFile) {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = readFileSync(file, "utf8");
    for (const match of code.matchAll(IMPORT_PATTERN)) visit(path.resolve(path.dirname(file), match[1]));
  };
  visit(entryFile);
  return [...seen].map((file) => path.relative(REPO_ROOT, file).split(path.sep).join("/"));
}

test("the display window’s code can’t reach the content loader", () => {
  const files = importGraph(path.join(REPO_ROOT, "src", "views", "display-view.js"));
  assert.ok(files.includes("src/presenter/display-channel.js"), "sanity check: the graph was followed");
  assert.ok(!files.includes("src/content/content-loader.js"), `display imports: ${files.join(", ")}`);
  for (const file of files) {
    const code = readFileSync(path.join(REPO_ROOT, file), "utf8");
    assert.ok(!/fetch\(|embedded-content|localStorage/.test(code), `${file} reads content or storage`);
  }
});
