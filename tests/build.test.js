// The offline build joins every code file into one script. These tests check the joiner.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { REPO_ROOT } from "../scripts/lib/content-files.js";
import { bundleModules } from "../scripts/lib/bundle-modules.js";

test("the site bundles with every file after its imports and no import/export left", () => {
  const { code, files } = bundleModules(path.join(REPO_ROOT, "src", "app.js"), REPO_ROOT);
  assert.equal(files.at(-1), "src/app.js");
  assert.ok(files.indexOf("src/presenter/timer.js") < files.indexOf("src/presenter/session.js"));
  assert.ok(!/^\s*(import|export)\s/m.test(code));
  new vm.Script(code); // throws on a syntax error
});

test("bundled modules keep their own names apart and share exports", () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "mh-bundle-"));
  try {
    writeFileSync(path.join(folder, "a.js"), "const secret = 1;\nexport function value() { return secret + 1; }\n");
    writeFileSync(path.join(folder, "b.js"), "const secret = 10;\nexport const total = secret;\n");
    writeFileSync(path.join(folder, "main.js"), 'import { value } from "./a.js";\nimport { total as fromB } from "./b.js";\nglobalThis.result = value() + fromB;\n');
    const { code } = bundleModules(path.join(folder, "main.js"), folder);
    const context = {};
    vm.runInNewContext(code, context);
    assert.equal(context.result, 12);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

test("unsupported import forms stop the build with a clear message", () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), "mh-bundle-"));
  try {
    writeFileSync(path.join(folder, "main.js"), "export default function main() {}\n");
    assert.throws(() => bundleModules(path.join(folder, "main.js"), folder), /export default/);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});
