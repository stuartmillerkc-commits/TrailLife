// The state of a meeting in progress, and every change a leader can make to it.
// Each function takes the current state and returns a new one; nothing here touches
// the page, so tests/session.test.js can drive a whole meeting.
//
// A "plan" is the sequence with its modules looked up:
//   { steps: [{ module, minutes, optional, stages }] }
// The state:
//   { stepIndex, stageIndex, revealed, blanked, shortOnTime, showTimerOnDisplay,
//     timers: [{ elapsedMs, runningSince }], meetingStartedAt }

import { createStepTimer, isRunning, pauseTimer, startTimer } from "./timer.js";

export function createSession(plan, { stepIndex = 0, shortOnTime = false } = {}) {
  return {
    stepIndex: clampStep(plan, stepIndex),
    stageIndex: 0,
    revealed: false,
    blanked: false,
    shortOnTime,
    showTimerOnDisplay: false,
    timers: plan.steps.map(() => createStepTimer()),
    meetingStartedAt: null
  };
}

// A step is skipped when Short on time is on and the step is marked optional.
export function isStepVisible(step, shortOnTime) {
  return !(shortOnTime && step.optional);
}

export function currentStep(plan, state) {
  return plan.steps[state.stepIndex];
}

export function currentStage(plan, state) {
  return currentStep(plan, state).stages[state.stageIndex];
}

// → : the next stage of this module, or the first stage of the next step still in the plan.
export function goNext(plan, state, now) {
  const step = currentStep(plan, state);
  if (state.stageIndex < step.stages.length - 1) return { ...state, stageIndex: state.stageIndex + 1, revealed: false };
  const nextIndex = findVisibleStep(plan, state, state.stepIndex + 1, +1);
  if (nextIndex === null) return state; // already at the end
  return moveToStep(plan, state, nextIndex, 0, now);
}

// ← : the previous stage, or the last stage of the previous step still in the plan.
export function goBack(plan, state, now) {
  if (state.stageIndex > 0) return { ...state, stageIndex: state.stageIndex - 1, revealed: false };
  const previousIndex = findVisibleStep(plan, state, state.stepIndex - 1, -1);
  if (previousIndex === null) return state;
  return moveToStep(plan, state, previousIndex, plan.steps[previousIndex].stages.length - 1, now);
}

// Clicking a step in the rail. Works even on a skipped step: the leader chose it.
export function jumpToStep(plan, state, stepIndex, now) {
  const target = clampStep(plan, stepIndex);
  if (target === state.stepIndex) return { ...state, stageIndex: 0, revealed: false };
  return moveToStep(plan, state, target, 0, now);
}

export function jumpToStage(plan, state, stageIndex) {
  const stages = currentStep(plan, state).stages;
  const target = Math.max(0, Math.min(stageIndex, stages.length - 1));
  return { ...state, stageIndex: target, revealed: false };
}

// R : only does something when the current stage has an answer.
export function toggleReveal(plan, state) {
  if (!currentStage(plan, state).hasAnswer) return state;
  return { ...state, revealed: !state.revealed };
}

// B
export function toggleBlank(state) {
  return { ...state, blanked: !state.blanked };
}

export function setShortOnTime(state, shortOnTime) {
  return { ...state, shortOnTime: Boolean(shortOnTime) };
}

export function setShowTimerOnDisplay(state, show) {
  return { ...state, showTimerOnDisplay: Boolean(show) };
}

// Space : start or pause the current step's timer. The first start also starts the meeting clock.
export function toggleTimer(state, now) {
  const timers = state.timers.slice();
  const timer = timers[state.stepIndex];
  timers[state.stepIndex] = isRunning(timer) ? pauseTimer(timer, now) : startTimer(timer, now);
  return { ...state, timers, meetingStartedAt: state.meetingStartedAt ?? now };
}

export function resetMeeting(plan, state) {
  return { ...createSession(plan, { stepIndex: 0, shortOnTime: state.shortOnTime }), showTimerOnDisplay: state.showTimerOnDisplay };
}

// ---------- helpers ----------

// Moving to another step hides the answer. If the old step's timer was running, it pauses
// and the new step's timer starts, so the clock follows the leader without extra key presses.
function moveToStep(plan, state, stepIndex, stageIndex, now) {
  const timers = state.timers.slice();
  const wasRunning = isRunning(timers[state.stepIndex]);
  if (wasRunning) {
    timers[state.stepIndex] = pauseTimer(timers[state.stepIndex], now);
    timers[stepIndex] = startTimer(timers[stepIndex], now);
  }
  return { ...state, stepIndex, stageIndex, revealed: false, timers };
}

function findVisibleStep(plan, state, startIndex, direction) {
  for (let index = startIndex; index >= 0 && index < plan.steps.length; index += direction) {
    if (isStepVisible(plan.steps[index], state.shortOnTime)) return index;
  }
  return null;
}

function clampStep(plan, stepIndex) {
  return Math.max(0, Math.min(Number(stepIndex) || 0, plan.steps.length - 1));
}
