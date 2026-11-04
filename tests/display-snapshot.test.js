// The projector must never show an answer before the leader reveals it, and never show
// leader notes at all. These tests build every projector snapshot for every module in
// /content and check what's inside. Run with `npm test`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "../scripts/lib/content-files.js";
import { buildDisplaySnapshot, buildIdleSnapshot } from "../src/presenter/display-snapshot.js";
import { buildStages } from "../src/presenter/stages.js";

const contentDirectory = path.join(REPO_ROOT, "content");
const { files } = JSON.parse(readFileSync(path.join(contentDirectory, "index.json"), "utf8"));
const modules = files.filter((file) => file.startsWith("modules/")).map((file) => JSON.parse(readFileSync(path.join(contentDirectory, file), "utf8")));

const SNAPSHOT_KEYS = ["blanked", "protocol", "screen", "timer", "type"];
const SCREEN_KEYS = ["answer", "body", "footer", "headline", "kicker", "points", "progress"];

// Text the boys are meant to see anyway. A leader-only string that also appears here
// (e.g. "E-1" in both the rank race instructions and its answer key) can't be a leak.
function publicTextOf(module) {
  return [module.title, module.displayContent.headline, module.displayContent.body || "", ...(module.displayContent.points || []),
    ...(module.prompts || []).map((prompt) => prompt.text), module.reveal?.title || ""].join("\n");
}

// Everything that must stay off the projector until revealed (answers) or forever (notes).
function leaderOnlyStrings(module) {
  return [
    ...(module.leaderScript || []),
    ...(module.discussionQuestions || []).flatMap((item) => [item.question, item.answer || ""]),
    ...(module.prompts || []).map((prompt) => prompt.answer),
    module.reveal?.text || "",
    ...(module.reveal?.items || []),
    ...(module.reveal?.table?.rows || []).flatMap((row) => row.cells),
    module.ifShortOnTime || "",
    module.lowVolunteerNote || "",
    ...(module.materials || [])
  ].filter((text) => text.length >= 4);
}

test("there are modules to check", () => {
  assert.ok(modules.length >= 12, `found ${modules.length} modules`);
});

for (const module of modules) {
  const stages = buildStages(module);
  const publicText = publicTextOf(module);
  const secrets = leaderOnlyStrings(module).filter((text) => !publicText.includes(text));

  test(`${module.id}: no unrevealed snapshot contains an answer or a leader note`, () => {
    assert.ok(secrets.length > 0, "sanity check: there are leader-only strings to look for");
    stages.forEach((stage, stageIndex) => {
      const snapshot = buildDisplaySnapshot({ module, stage, revealed: false, footer: "Footer" });
      assert.equal(snapshot.screen.answer, null, `stage ${stageIndex} (${stage.label}) has an answer before reveal`);
      const sent = JSON.stringify(snapshot);
      for (const secret of secrets) {
        assert.ok(!sent.includes(secret), `stage ${stageIndex} (${stage.label}) leaks leader-only text: “${secret.slice(0, 60)}”`);
      }
    });
  });

  test(`${module.id}: snapshots contain only the allowed fields`, () => {
    stages.forEach((stage) => {
      for (const revealed of [false, true]) {
        const snapshot = buildDisplaySnapshot({ module, stage, revealed });
        assert.deepEqual(Object.keys(snapshot).sort(), SNAPSHOT_KEYS);
        assert.deepEqual(Object.keys(snapshot.screen).sort(), SCREEN_KEYS);
        assert.ok(!JSON.stringify(snapshot).includes("factIds"), "fact ids don’t go to the projector");
      }
    });
  });

  test(`${module.id}: revealing shows the answer on every stage that has one`, () => {
    stages.filter((stage) => stage.hasAnswer).forEach((stage) => {
      const snapshot = buildDisplaySnapshot({ module, stage, revealed: true });
      assert.ok(snapshot.screen.answer, `${stage.label} shows nothing after reveal`);
    });
  });

  test(`${module.id}: blanking sends no screen at all, even when revealed`, () => {
    stages.forEach((stage) => {
      const snapshot = buildDisplaySnapshot({ module, stage, revealed: true, blanked: true, timer: { running: true, remainingSeconds: 60 } });
      assert.equal(snapshot.blanked, true);
      assert.equal(snapshot.screen, null);
      assert.equal(snapshot.timer, null);
    });
  });
}

test("a revealed prompt shows that prompt’s answer and no other", () => {
  const module = modules.find((record) => record.id === "academy-run-and-sort");
  const stages = buildStages(module);
  const graduateStage = stages.find((stage) => stage.kind === "prompt" && stage.promptIndex === 0);
  const sent = JSON.stringify(buildDisplaySnapshot({ module, stage: graduateStage, revealed: true }));
  assert.ok(sent.includes(module.prompts[0].answer));
  module.prompts.slice(1).forEach((prompt) => assert.ok(!sent.includes(prompt.answer), `also leaked “${prompt.answer}”`));
});

test("the idle snapshot carries nothing", () => {
  assert.deepEqual(buildIdleSnapshot(), { type: "screen", protocol: 1, blanked: false, screen: null, timer: null });
});

test("extra fields on a module never reach the projector", () => {
  const module = {
    id: "planted", title: "Planted", requirements: [], durationMinutes: 5, activityType: ["discussion"],
    displayContent: { headline: "Visible", body: "Visible body", secretField: "SECRET-IN-DISPLAY" },
    leaderNote: "SECRET-NOTE",
    prompts: [{ text: "Visible prompt", answer: "SECRET-ANSWER", extra: "SECRET-EXTRA" }]
  };
  for (const stage of buildStages(module)) {
    const sent = JSON.stringify(buildDisplaySnapshot({ module, stage, revealed: false }));
    assert.ok(!/SECRET/.test(sent), sent);
  }
});
