// Tests for scripts/check-sources.js. Run with `npm test`.
// Uses Node's built-in test runner, so there's nothing to install.

import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCheck } from "../scripts/check-sources.js";
import { REPO_ROOT, loadSchemaMap } from "../scripts/lib/content-files.js";
import { isRealDate } from "../scripts/lib/json-schema-lite.js";

const fixture = (name) => path.join(REPO_ROOT, "tests", "fixtures", name, "content");
const messagesOf = (items) => items.map(({ where, message }) => `${where}: ${message}`).join("\n");

// Copies a fixture to a temporary folder, lets the test change one file, runs the check, cleans up.
// Pass "real" as the fixture name to copy the site's own /content instead.
function checkModifiedCopy(fixtureName, relativeFile, change, options = {}) {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "mh-check-"));
  const contentDirectory = path.join(temporaryRoot, "content");
  const sourceDirectory = fixtureName === "real" ? path.join(REPO_ROOT, "content") : fixture(fixtureName);
  try {
    cpSync(sourceDirectory, contentDirectory, { recursive: true });
    const filePath = path.join(contentDirectory, relativeFile);
    const data = JSON.parse(readFileSync(filePath, "utf8"));
    writeFileSync(filePath, JSON.stringify(change(data) ?? data));
    return runCheck({ contentDirectory, ...options });
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

test("the real content passes", () => {
  const result = runCheck();
  assert.equal(result.errors.length, 0, messagesOf(result.errors));
  assert.ok(result.stats.facts >= 1 && result.stats.modules >= 1);
});

test("a fact with no source fails, and the message names the fact", () => {
  const result = runCheck({ contentDirectory: fixture("failing-fact") });
  const text = messagesOf(result.errors);
  assert.match(text, /branch-army-founded.*has no source/);
  assert.match(text, /branch-army-founded.*has no "verifiedOn" date/);
});

test("the command line exits 1 on failure and 0 on success", () => {
  const run = (...extraArguments) => spawnSync(process.execPath, ["scripts/check-sources.js", ...extraArguments], { cwd: REPO_ROOT, encoding: "utf8" });
  assert.equal(run("--content", fixture("failing-fact")).status, 1);
  assert.equal(run().status, 0);
});

test("the example battle exercises every battle schema and passes", () => {
  const result = runCheck({ contentDirectory: fixture("example-battle") });
  assert.equal(result.errors.length, 0, messagesOf(result.errors));
  assert.equal(result.stats.battles, 1);
  assert.equal(result.needsVerification.length, 2, "one unverified fact and one estimated position");
});

test("--strict turns needsVerification into errors", () => {
  const result = runCheck({ contentDirectory: fixture("example-battle"), strict: true });
  assert.match(messagesOf(result.errors), /example-unverified.*needsVerification/);
});

test("a verifiedOn date in the future fails", () => {
  const result = runCheck({ contentDirectory: fixture("example-battle"), today: "2026-01-01" });
  assert.match(messagesOf(result.errors), /example-fact.*in the future/);
});

test("a disagreement alternative without its own source fails", () => {
  const result = checkModifiedCopy("example-battle", "facts/example.json", (facts) => { delete facts[0].disagreement.alternatives[0].source; });
  assert.match(messagesOf(result.errors), /alternative 1.*needs its own source/);
});

test("a reference to a missing fact or source fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/battle.json", (battle) => {
    battle.factIds.push("no-such-fact");
    battle.sourceIds.push("no-such-source");
  });
  const text = messagesOf(result.errors);
  assert.match(text, /fact "no-such-fact", which doesn't exist/);
  assert.match(text, /source "no-such-source", which isn't in/);
});

test("a battle phase without sourceIds fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/phases.json", (phases) => { delete phases[1].sourceIds; });
  assert.match(messagesOf(result.errors), /missing required field "sourceIds"/);
});

test("a phase that moves an unknown unit fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/phases.json", (phases) => { phases[1].units["ghost-unit"] = { position: [1, 1] }; });
  assert.match(messagesOf(result.errors), /unit "ghost-unit" isn't in units.json/);
});

test("a grid that doesn't tile the field fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/battle.json", (battle) => { battle.grid.columns = 8; });
  assert.match(messagesOf(result.errors), /grid.columns × grid.cellSize/);
});

test("a what-if without a confidence label fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/whatifs.json", (whatIfs) => { delete whatIfs[0].confidence; });
  assert.match(messagesOf(result.errors), /missing required field "confidence"/);
});

test("a what-if without reasoningSourceIds fails", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/whatifs.json", (whatIfs) => { delete whatIfs[0].reasoningSourceIds; });
  assert.match(messagesOf(result.errors), /missing required field "reasoningSourceIds"/);
});

test("a what-if must fork at a decision point", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/whatifs.json", (whatIfs) => { whatIfs[0].forkPhase = 0; });
  assert.match(messagesOf(result.errors), /has no decisionPoint/);
});

test("a what-if that states a casualty figure gets a warning", () => {
  const result = checkModifiedCopy("example-battle", "battles/example-ridge/whatifs.json", (whatIfs) => { whatIfs[0].phases[0].narration = "Red loses 300 killed."; });
  assert.match(messagesOf(result.warnings), /casualty figure/);
});

test("straight quotes in reader-facing text get a warning", () => {
  const result = checkModifiedCopy("example-battle", "facts/example.json", (facts) => { facts[0].statement = "It's made up."; });
  assert.match(messagesOf(result.warnings), /straight quote/);
});

test("invalid JSON fails with the file name", () => {
  const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "mh-check-"));
  try {
    cpSync(fixture("example-battle"), path.join(temporaryRoot, "content"), { recursive: true });
    writeFileSync(path.join(temporaryRoot, "content", "facts", "example.json"), "[ { \"id\": \"oops\", } ]");
    const result = runCheck({ contentDirectory: path.join(temporaryRoot, "content") });
    assert.match(messagesOf(result.errors), /facts\/example.json: isn't valid JSON/);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test("a prompt without factIds fails", () => {
  const result = checkModifiedCopy("real", "modules/academy-run-and-sort.json", (module) => { delete module.prompts[0].factIds; });
  assert.match(messagesOf(result.errors), /prompt 1 \("Ulysses S. Grant"\) has no factIds/);
});

test("an answer-key row without factIds fails", () => {
  const result = checkModifiedCopy("real", "modules/branch-timeline-race.json", (module) => { delete module.reveal.table.rows[0].factIds; });
  assert.match(messagesOf(result.errors), /answer-key row 1 .* has no factIds/);
});

test("an answer-key row with the wrong number of cells fails", () => {
  const result = checkModifiedCopy("real", "modules/branch-timeline-race.json", (module) => { module.reveal.table.rows[0].cells.pop(); });
  assert.match(messagesOf(result.errors), /one cell per column/);
});

test("reveal.afterPrompt past the last prompt fails", () => {
  const result = checkModifiedCopy("real", "modules/rank-ladder-race.json", (module) => { module.reveal.afterPrompt = 9; });
  assert.match(messagesOf(result.errors), /afterPrompt is 9, but the module has 2 prompt/);
});

test("a projector answer resting on an unverified fact gets a warning", () => {
  const result = checkModifiedCopy("real", "facts/branches.json", (facts) => {
    const fact = facts.find((record) => record.id === "branch-army-founded");
    fact.needsVerification = true;
  });
  assert.match(messagesOf(result.warnings), /branch-timeline-race.*unverified fact "branch-army-founded"/);
});

test("VS Code's schema settings match schemas/schema-map.json", () => {
  const editorSettings = JSON.parse(readFileSync(path.join(REPO_ROOT, ".vscode", "settings.json"), "utf8"))["json.schemas"];
  const fromEditor = editorSettings.map(({ fileMatch, url }) => `${fileMatch[0].replace("**/content/", "")} -> ${url.replace("./schemas/", "")}`).sort();
  const fromMap = loadSchemaMap().map(({ pattern, schema }) => `${pattern} -> ${schema}`).sort();
  assert.deepEqual(fromEditor, fromMap);
});

test("dates are checked for real calendar days", () => {
  assert.equal(isRealDate("2026-11-04"), true);
  assert.equal(isRealDate("2026-02-30"), false);
  assert.equal(isRealDate("11/04/2026"), false);
});
