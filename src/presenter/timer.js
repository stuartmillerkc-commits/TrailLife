// Timer math for the sequence player. No DOM and no clock reads: callers pass "now"
// (milliseconds, from Date.now()), which keeps this easy to test.
//
// Each step keeps its own timer: { elapsedMs, runningSince }. runningSince is the
// moment it was started, or null while paused. Jumping between steps never loses time.

export const WARNING_MS = 2 * 60 * 1000; // soft warning at 2 minutes left (PLAN.md 7.1)

export function createStepTimer() {
  return { elapsedMs: 0, runningSince: null };
}

export function elapsedMs(timer, now) {
  if (!timer) return 0;
  return timer.elapsedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));
}

export function isRunning(timer) {
  return Boolean(timer && timer.runningSince !== null);
}

export function startTimer(timer, now) {
  return isRunning(timer) ? timer : { elapsedMs: timer.elapsedMs, runningSince: now };
}

export function pauseTimer(timer, now) {
  return isRunning(timer) ? { elapsedMs: elapsedMs(timer, now), runningSince: null } : timer;
}

export function remainingMs(plannedMinutes, timer, now) {
  return plannedMinutes * 60 * 1000 - elapsedMs(timer, now);
}

// "normal", "warning" (2 minutes or less left) or "overtime" (past the planned time).
export function timerLevel(remaining) {
  if (remaining < 0) return "overtime";
  if (remaining <= WARNING_MS) return "warning";
  return "normal";
}

// 702000 -> "11:42"; -65000 -> "−1:05" (a real minus sign, so it reads clearly on screen).
export function formatClock(milliseconds) {
  const negative = milliseconds < 0;
  const totalSeconds = Math.floor(Math.abs(milliseconds) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${negative ? "−" : ""}${minutes}:${String(seconds).padStart(2, "0")}`;
}

// How far behind (positive) or ahead (negative) of the plan the meeting is, in milliseconds.
// Only steps that were actually timed count:
//   - each earlier step that has time on its clock adds (time used − time planned)
//   - the current step adds its overrun once it passes its planned time (running short
//     on the current step isn't "ahead" yet; it might still use all its time)
// Steps never timed (skipped, or before the leader started the clock) add nothing, so
// starting the timer at step 3 reads "on time", not "20 min ahead".
// Returns null until the meeting has started.
//   steps: [{ minutes }]   timers: one per step   currentIndex: the step on screen
export function scheduleDriftMs({ steps, timers, currentIndex, meetingStartedAt, now }) {
  if (meetingStartedAt === null || meetingStartedAt === undefined) return null;
  let drift = 0;
  steps.forEach((step, index) => {
    const used = elapsedMs(timers[index], now);
    const planned = step.minutes * 60000;
    if (index < currentIndex && used > 0) drift += used - planned;
    if (index === currentIndex) drift += Math.max(0, used - planned);
  });
  return drift;
}

// -125000 -> "2 min ahead"; 30000 -> "on time" (within a minute either way).
export function describeDrift(driftMs) {
  if (driftMs === null) return "Not started";
  const minutes = Math.round(driftMs / 60000);
  if (minutes === 0) return "On time";
  return minutes > 0 ? `${minutes} min behind` : `${-minutes} min ahead`;
}
