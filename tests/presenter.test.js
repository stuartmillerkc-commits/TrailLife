// Tests for the presenter's logic: stages, meeting navigation, Short on time,
// reveal and blank, timers, deep links, and the display's message filter.

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildStages } from "../src/presenter/stages.js";
import {
  createSession, currentStage, goBack, goNext, jumpToStep, setShortOnTime, toggleBlank, toggleReveal, toggleTimer
} from "../src/presenter/session.js";
import { describeDrift, elapsedMs, formatClock, remainingMs, scheduleDriftMs, timerLevel } from "../src/presenter/timer.js";
import { buildHash, parseHash } from "../src/router.js";
import { acceptLeaderMessage } from "../src/presenter/display-channel.js";

// ---------- a small made-up meeting ----------
const withPrompts = {
  id: "with-prompts", title: "With prompts", promptLabel: "Scenario",
  displayContent: { headline: "Judge it" },
  prompts: [{ text: "One", answer: "A1" }, { text: "Two", answer: "A2" }],
  reveal: { type: "text", text: "Key", afterPrompt: 0 }
};
const plain = { id: "plain", title: "Plain", displayContent: { headline: "Plain" }, reveal: { type: "text", text: "Answer" } };
const noAnswer = { id: "no-answer", title: "No answer", displayContent: { headline: "Talk" } };

const plan = {
  steps: [
    { module: plain, minutes: 5, optional: false },
    { module: withPrompts, minutes: 10, optional: false },
    { module: noAnswer, minutes: 10, optional: true },
    { module: plain, minutes: 5, optional: false }
  ].map((step) => ({ ...step, stages: buildStages(step.module) }))
};
const MINUTE = 60000;

// ---------- stages ----------
test("a module without prompts has one stage, with the answer key on it", () => {
  assert.deepEqual(buildStages(plain).map((stage) => [stage.kind, stage.hasAnswer]), [["intro", true]]);
  assert.deepEqual(buildStages(noAnswer).map((stage) => [stage.kind, stage.hasAnswer]), [["intro", false]]);
});

test("afterPrompt places the answer key; leaving it out puts it last", () => {
  assert.deepEqual(buildStages(withPrompts).map((stage) => stage.kind), ["intro", "answer-key", "prompt", "prompt"]);
  const keyLast = { ...withPrompts, reveal: { type: "text", text: "Key" } };
  assert.deepEqual(buildStages(keyLast).map((stage) => stage.kind), ["intro", "prompt", "prompt", "answer-key"]);
  assert.equal(buildStages(withPrompts)[2].label, "Scenario 1 of 2");
});

// ---------- navigation ----------
test("→ walks every stage, then the next step; ← walks back to the previous step’s last stage", () => {
  let state = createSession(plan);
  state = goNext(plan, state, 0);
  assert.deepEqual([state.stepIndex, state.stageIndex], [1, 0]);
  state = goNext(plan, goNext(plan, goNext(plan, state, 0), 0), 0);
  assert.deepEqual([state.stepIndex, state.stageIndex], [1, 3]);
  state = goNext(plan, state, 0);
  assert.deepEqual([state.stepIndex, state.stageIndex], [2, 0]);
  state = goBack(plan, state, 0);
  assert.deepEqual([state.stepIndex, state.stageIndex], [1, 3]);
});

test("→ at the very end and ← at the very start change nothing", () => {
  const start = createSession(plan);
  assert.equal(goBack(plan, start, 0), start);
  const end = jumpToStep(plan, start, 3, 0);
  assert.equal(goNext(plan, end, 0), end);
});

test("Short on time skips optional steps both ways, but a click can still open one", () => {
  let state = setShortOnTime(jumpToStep(plan, createSession(plan), 1, 0), true);
  state = { ...state, stageIndex: 3 };
  state = goNext(plan, state, 0);
  assert.equal(state.stepIndex, 3, "skipped optional step 3");
  state = goBack(plan, state, 0);
  assert.equal(state.stepIndex, 1, "skipped it going back too");
  assert.equal(jumpToStep(plan, state, 2, 0).stepIndex, 2);
});

test("any move hides the answer again", () => {
  let state = toggleReveal(plan, createSession(plan));
  assert.equal(state.revealed, true);
  assert.equal(goNext(plan, state, 0).revealed, false);
  state = toggleReveal(plan, jumpToStep(plan, state, 1, 0));
  state = { ...state, revealed: true, stageIndex: 2 };
  assert.equal(goBack(plan, state, 0).revealed, false);
  assert.equal(jumpToStep(plan, state, 0, 0).revealed, false);
});

test("R does nothing on a screen without an answer", () => {
  const state = jumpToStep(plan, createSession(plan), 2, 0);
  assert.equal(currentStage(plan, state).hasAnswer, false);
  assert.equal(toggleReveal(plan, state), state);
});

test("B toggles blank and leaves the position alone", () => {
  const state = toggleBlank(createSession(plan));
  assert.equal(state.blanked, true);
  assert.equal(toggleBlank(state).blanked, false);
  assert.equal(state.stepIndex, 0);
});

// ---------- timers ----------
test("Space starts and pauses the step timer; the first start starts the meeting", () => {
  let state = toggleTimer(createSession(plan), 1000);
  assert.equal(state.meetingStartedAt, 1000);
  state = toggleTimer(state, 1000 + 30000);
  assert.equal(elapsedMs(state.timers[0], 999999), 30000);
});

test("moving on carries a running clock to the next step, and jumping back keeps each step’s time", () => {
  let state = toggleTimer(createSession(plan), 0);
  state = goNext(plan, state, 4 * MINUTE);
  assert.equal(elapsedMs(state.timers[0], 10 * MINUTE), 4 * MINUTE, "step 1 paused at 4 minutes");
  assert.equal(elapsedMs(state.timers[1], 6 * MINUTE), 2 * MINUTE, "step 2 started on arrival");
  state = jumpToStep(plan, state, 0, 6 * MINUTE);
  assert.equal(elapsedMs(state.timers[1], 20 * MINUTE), 2 * MINUTE, "step 2 kept its 2 minutes");
  assert.equal(elapsedMs(state.timers[0], 7 * MINUTE), 5 * MINUTE, "step 1 resumed from 4 minutes");
});

test("timer levels: normal, warning at 2 minutes left, overtime past zero", () => {
  assert.equal(timerLevel(3 * MINUTE), "normal");
  assert.equal(timerLevel(2 * MINUTE), "warning");
  assert.equal(timerLevel(-1), "overtime");
  assert.equal(remainingMs(5, { elapsedMs: 4 * MINUTE, runningSince: null }, 0), MINUTE);
  assert.equal(formatClock(702000), "11:42");
  assert.equal(formatClock(-65000), "−1:05");
});

test("behind or ahead of schedule", () => {
  const steps = plan.steps.map((step) => ({ minutes: step.minutes, visible: true }));
  const fresh = plan.steps.map(() => ({ elapsedMs: 0, runningSince: null }));
  assert.equal(scheduleDriftMs({ steps, timers: fresh, currentIndex: 0, meetingStartedAt: null, now: 0 }), null);
  // 8 minutes in, still on the 5-minute first step: 3 minutes behind.
  const timers = fresh.map((timer, index) => (index === 0 ? { elapsedMs: 8 * MINUTE, runningSince: null } : timer));
  assert.equal(describeDrift(scheduleDriftMs({ steps, timers, currentIndex: 0, meetingStartedAt: 0, now: 8 * MINUTE })), "3 min behind");
  // Moving to step 2 after 3 minutes: 2 minutes ahead.
  assert.equal(describeDrift(scheduleDriftMs({ steps, timers: fresh, currentIndex: 1, meetingStartedAt: 0, now: 3 * MINUTE })), "2 min ahead");
  // Short on time drops the optional 10-minute step from the plan.
  const short = steps.map((step, index) => ({ ...step, visible: index !== 2 }));
  assert.equal(describeDrift(scheduleDriftMs({ steps: short, timers: fresh, currentIndex: 0, meetingStartedAt: 0, now: 0 })), "On time");
});

// ---------- deep links ----------
test("deep links parse and rebuild", () => {
  assert.deepEqual(parseHash("#/lead/meeting-1-who-serves/3?short=on"), { name: "lead", sequenceId: "meeting-1-who-serves", stepNumber: 3, stepGiven: true, shortOnTime: true });
  assert.deepEqual(parseHash("#/lead/meeting-1-who-serves"), { name: "lead", sequenceId: "meeting-1-who-serves", stepNumber: 1 });
  assert.deepEqual(parseHash("#/module/academy-run-and-sort"), { name: "module", moduleId: "academy-run-and-sort" });
  assert.equal(parseHash("").name, "home");
  assert.equal(parseHash("#/display").name, "display");
  assert.equal(parseHash("#/modules").name, "library");
  assert.equal(parseHash("#/lead/meeting-1/0").name, "not-found");
  assert.equal(parseHash("#/module/Bad_Id").name, "not-found");
  assert.equal(buildHash({ name: "lead", sequenceId: "meeting-1-who-serves", stepNumber: 3, shortOnTime: true }), "#/lead/meeting-1-who-serves/3?short=on");
  assert.equal(buildHash({ name: "lead", sequenceId: "meeting-1-who-serves", stepNumber: 1 }), "#/lead/meeting-1-who-serves");
});

// ---------- the display's message filter ----------
test("the display ignores repeats, old messages and anything malformed", () => {
  let tracker = { sessionId: null, lastMessageNumber: 0 };
  const message = (sessionId, messageNumber, type = "screen") => ({ protocol: 1, type, sessionId, messageNumber });

  let result = acceptLeaderMessage(tracker, message("a", 1));
  assert.equal(result.accept, true);
  tracker = result.tracker;
  assert.equal(acceptLeaderMessage(tracker, message("a", 1)).accept, false, "same message by the second route");
  assert.equal(acceptLeaderMessage(tracker, message("a", 0)).accept, false, "older message");
  assert.equal(acceptLeaderMessage(tracker, message("b", 1)).accept, true, "reloaded leader page");
  assert.equal(acceptLeaderMessage(tracker, { ...message("a", 5), protocol: 2 }).accept, false);
  assert.equal(acceptLeaderMessage(tracker, message("a", 6, "key")).accept, false, "only screen and goodbye come from the leader");
  assert.equal(acceptLeaderMessage(tracker, null).accept, false);
});
