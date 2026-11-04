// The leader's lesson screen. One view serves two pages:
//   - the sequence player (#/lead/<sequence>/<step>): steps rail, timer, short-on-time toggle
//   - a single module page (#/module/<id>): the same presenter for one module, no timer
// Both drive the projector window through the leader link.
//
// Keyboard (PLAN.md section 5): → next, ← back, Space start/pause the timer, R reveal, B blank.

import { buildDisplaySnapshot } from "../presenter/display-snapshot.js";
import { buildStages } from "../presenter/stages.js";
import {
  createSession, currentStage, currentStep, goBack, goNext, isStepVisible, jumpToStage, jumpToStep,
  resetMeeting, setShortOnTime, setShowTimerOnDisplay, toggleBlank, toggleReveal, toggleTimer
} from "../presenter/session.js";
import { describeDrift, elapsedMs, formatClock, isRunning, remainingMs, scheduleDriftMs, timerLevel } from "../presenter/timer.js";
import { buildHash } from "../router.js";
import { makeElement } from "./dom.js";
import { renderAnswer, renderDisplaySnapshot } from "./display-renderer.js";
import { describeModuleMeta, renderLeaderPanels, renderRequirementBadges } from "./leader-panels.js";

const STORAGE_PREFIX = "military-heritage:session:";

// options: { mode: "sequence" | "module", sequence?, module?, route, content, link }
export function startPresenterView(root, options) {
  const { mode, content, link } = options;
  const isSequence = mode === "sequence";
  const plan = isSequence ? buildSequencePlan(options.sequence, content) : buildModulePlan(options.module);
  const title = isSequence ? options.sequence.title : options.module.title;
  const storageKey = isSequence ? `${STORAGE_PREFIX}${options.sequence.id}` : null;

  let state = restoreState(plan, storageKey, options.route);
  let renderedStepIndex = null; // the step whose panels are on the page

  document.body.className = "lead-mode";
  document.title = `${title} — Military Heritage`;

  // ---------- page skeleton ----------
  const timerReadout = makeElement("span", { className: "timer-readout", attributes: { "aria-live": "off" } });
  const timerButton = makeElement("button", { className: "secondary", attributes: { type: "button" }, onClick: () => apply(toggleTimer(state, Date.now())) });
  const meetingReadout = makeElement("span", { className: "meeting-readout" });
  const shortToggle = makeElement("input", { attributes: { type: "checkbox", id: "short-on-time" } });
  shortToggle.addEventListener("change", () => apply(setShortOnTime(state, shortToggle.checked)));
  const projectorTimerToggle = makeElement("input", { attributes: { type: "checkbox", id: "timer-on-projector" } });
  projectorTimerToggle.addEventListener("change", () => apply(setShowTimerOnDisplay(state, projectorTimerToggle.checked)));
  const projectorStatus = makeElement("span", { className: "projector-status", attributes: { role: "status" } });
  const openDisplayButton = makeElement("button", {
    className: "primary",
    text: "Open display window",
    attributes: { type: "button" },
    onClick: () => { if (!link.openDisplayWindow()) alert("The browser blocked the display window. Allow pop-ups for this site and try again."); }
  });

  const header = makeElement("header", { className: "lead-header" }, [
    makeElement("nav", { className: "breadcrumb", attributes: { "aria-label": "Breadcrumb" } }, [
      makeElement("a", { text: "Home", attributes: { href: buildHash({ name: "home" }) } }),
      " › ",
      isSequence
        ? makeElement("a", { text: "Lead a meeting", attributes: { href: buildHash({ name: "meetings" }) } })
        : makeElement("a", { text: "Module library", attributes: { href: buildHash({ name: "library" }) } }),
      " › ",
      makeElement("span", { text: title, attributes: { "aria-current": "page" } })
    ]),
    makeElement("div", { className: "control-bar" }, [
      isSequence ? makeElement("span", { className: "timer-group" }, [timerReadout, timerButton]) : null,
      isSequence ? meetingReadout : null,
      isSequence ? makeElement("label", { className: "toggle" }, [shortToggle, " Short on time"]) : null,
      isSequence ? makeElement("label", { className: "toggle" }, [projectorTimerToggle, " Timer on projector"]) : null,
      projectorStatus,
      openDisplayButton
    ])
  ]);

  const rail = isSequence ? makeElement("nav", { className: "steps-rail", attributes: { "aria-label": "Steps" } }) : null;
  const stepArea = makeElement("section", { className: "step-area", attributes: { "aria-labelledby": "step-title" } });
  const layout = makeElement("div", { className: isSequence ? "lead-layout" : "lead-layout single" }, [rail, stepArea]);
  const main = makeElement("main", { attributes: { id: "main", tabindex: "-1" } }, [header, layout]);
  const keyHelp = makeElement("p", { className: "key-help", text: isSequence
    ? "Keys: → next · ← back · Space start or pause timer · R reveal · B blank the projector"
    : "Keys: → next · ← back · R reveal · B blank the projector" });
  root.replaceChildren(main, keyHelp);

  // Parts of the step area that change on every key press.
  const stepParts = {};

  // ---------- drawing ----------
  function renderStepStatic() {
    const step = currentStep(plan, state);
    const module = step.module;
    stepParts.preview = makeElement("div", { className: "display-stage preview", attributes: { "aria-label": "Projector preview" } });
    stepParts.stageList = makeElement("ol", { className: "stage-list" });
    stepParts.leaderAnswer = makeElement("div", { className: "leader-answer-box" });
    stepParts.revealButton = makeElement("button", { className: "primary", attributes: { type: "button" }, onClick: () => apply(toggleReveal(plan, state)) });
    stepParts.blankButton = makeElement("button", { className: "secondary", attributes: { type: "button" }, onClick: () => apply(toggleBlank(state)) });
    stepParts.shortNote = makeElement("div", { className: "short-note", attributes: { role: "note" } });
    stepParts.stepMeta = makeElement("p", { className: "card-meta" });

    stepArea.replaceChildren(
      stepParts.stepMeta,
      makeElement("h1", { text: module.title, attributes: { id: "step-title" } }),
      makeElement("p", { className: "card-meta" }, [renderRequirementBadges(module), " ", describeModuleMeta(module)]),
      !isSequence ? renderUsedIn(module.id, content) : null,
      stepParts.shortNote,
      makeElement("div", { className: "presenter" }, [
        makeElement("div", { className: "preview-column" }, [
          makeElement("p", { className: "preview-label", text: "On the projector" }),
          stepParts.preview,
          makeElement("div", { className: "presenter-buttons" }, [
            makeElement("button", { className: "secondary", text: "← Back", attributes: { type: "button" }, onClick: () => apply(goBack(plan, state, Date.now())) }),
            stepParts.revealButton,
            stepParts.blankButton,
            makeElement("button", { className: "primary", text: "Next →", attributes: { type: "button" }, onClick: () => apply(goNext(plan, state, Date.now())) })
          ])
        ]),
        makeElement("div", { className: "stage-column" }, [
          makeElement("p", { className: "preview-label", text: "Screens in this module" }),
          stepParts.stageList,
          stepParts.leaderAnswer
        ])
      ]),
      ...renderLeaderPanels(module, content)
    );
    renderedStepIndex = state.stepIndex;
  }

  function renderDynamic(now = Date.now()) {
    const step = currentStep(plan, state);
    const stage = currentStage(plan, state);
    const snapshot = currentSnapshot(now);

    renderDisplaySnapshot(stepParts.preview, snapshot, { waitingText: "" });
    stepParts.preview.classList.toggle("is-blank", state.blanked);
    if (state.blanked) stepParts.preview.replaceChildren(makeElement("p", { className: "preview-blank-label", text: "Projector blanked (B)" }));

    stepParts.stepMeta.textContent = isSequence ? `Step ${state.stepIndex + 1} of ${plan.steps.length} · ${step.minutes} min planned${step.optional ? " · optional" : ""}` : "Module";
    stepParts.revealButton.textContent = stage.hasAnswer ? (state.revealed ? "Hide answer (R)" : "Reveal answer (R)") : "No answer here";
    stepParts.revealButton.disabled = !stage.hasAnswer;
    stepParts.blankButton.textContent = state.blanked ? "Unblank (B)" : "Blank (B)";
    stepParts.blankButton.setAttribute("aria-pressed", String(state.blanked));

    const showShortNote = state.shortOnTime && step.module.ifShortOnTime;
    stepParts.shortNote.hidden = !showShortNote;
    stepParts.shortNote.replaceChildren(...(showShortNote ? [makeElement("strong", { text: "Short on time: " }), step.module.ifShortOnTime] : []));

    stepParts.stageList.replaceChildren(...step.stages.map((stageItem, stageIndex) => {
      const label = stageItem.kind === "prompt" ? `${stageItem.label}: ${step.module.prompts[stageItem.promptIndex].text}` : stageItem.label;
      return makeElement("li", {}, [makeElement("button", {
        className: stageIndex === state.stageIndex ? "stage-button current" : "stage-button",
        text: label,
        attributes: { type: "button", "aria-current": stageIndex === state.stageIndex ? "step" : null },
        onClick: () => apply(jumpToStage(plan, state, stageIndex))
      })]);
    }));

    // The answer for the current screen, always visible to the leader.
    const leaderView = buildDisplaySnapshot({ module: step.module, stage, revealed: true });
    stepParts.leaderAnswer.replaceChildren(...(stage.hasAnswer && leaderView.screen?.answer
      ? [makeElement("p", { className: "preview-label", text: state.revealed ? "Answer (on the projector now)" : "Answer (leader only until you press R)" }), renderAnswer(leaderView.screen.answer)]
      : [makeElement("p", { className: "card-meta", text: "This screen has no answer to reveal." })]));

    if (rail) renderRail();
    renderTimer(now);
    shortToggle.checked = state.shortOnTime;
    projectorTimerToggle.checked = state.showTimerOnDisplay;
    renderProjectorStatus();
  }

  function renderRail() {
    const visibleMinutes = plan.steps.filter((step) => isStepVisible(step, state.shortOnTime)).reduce((total, step) => total + step.minutes, 0);
    const fullMinutes = plan.steps.reduce((total, step) => total + step.minutes, 0);
    rail.replaceChildren(
      makeElement("p", { className: "rail-heading", text: state.shortOnTime && visibleMinutes !== fullMinutes ? `Steps · ${fullMinutes} → ${visibleMinutes} min` : `Steps · ${fullMinutes} min` }),
      makeElement("ol", {}, plan.steps.map((step, stepIndex) => {
        const skipped = !isStepVisible(step, state.shortOnTime);
        const done = elapsedMs(state.timers[stepIndex], Date.now()) > 0 && stepIndex < state.stepIndex;
        const classes = ["rail-step", stepIndex === state.stepIndex ? "current" : "", skipped ? "skipped" : "", done ? "done" : ""].filter(Boolean).join(" ");
        return makeElement("li", {}, [makeElement("button", {
          className: classes,
          attributes: { type: "button", "aria-current": stepIndex === state.stepIndex ? "step" : null, title: skipped ? "Skipped while Short on time is on" : null },
          onClick: () => apply(jumpToStep(plan, state, stepIndex, Date.now()))
        }, [
          makeElement("span", { className: "rail-number", text: done ? "✓" : String(stepIndex + 1) }),
          makeElement("span", { className: "rail-title", text: step.module.title }),
          makeElement("span", { className: "rail-minutes", text: `${step.minutes}${step.optional ? " · opt." : ""}` })
        ])]);
      })),
      makeElement("button", {
        className: "link-button",
        text: "Reset meeting",
        attributes: { type: "button" },
        onClick: () => { if (confirm("Reset all timers and go back to step 1?")) apply(resetMeeting(plan, state)); }
      })
    );
  }

  function renderTimer(now) {
    if (!isSequence) return;
    const step = currentStep(plan, state);
    const timer = state.timers[state.stepIndex];
    const remaining = remainingMs(step.minutes, timer, now);
    const level = timerLevel(remaining);
    timerReadout.textContent = remaining < 0 ? `⏱ ${formatClock(-remaining)} over` : `⏱ ${formatClock(remaining)} left`;
    timerReadout.className = `timer-readout level-${level}`;
    timerButton.textContent = isRunning(timer) ? "Pause (Space)" : (elapsedMs(timer, now) > 0 ? "Resume (Space)" : "Start (Space)");
    const drift = scheduleDriftMs({
      steps: plan.steps.map((planStep) => ({ minutes: planStep.minutes, visible: isStepVisible(planStep, state.shortOnTime) })),
      timers: state.timers,
      currentIndex: state.stepIndex,
      meetingStartedAt: state.meetingStartedAt,
      now
    });
    const meetingElapsed = state.meetingStartedAt === null ? "" : `Meeting ${formatClock(now - state.meetingStartedAt)} · `;
    meetingReadout.textContent = `${meetingElapsed}${describeDrift(drift)}`;
  }

  function renderProjectorStatus() {
    const answerText = currentStage(plan, state).hasAnswer ? (state.revealed ? "answer showing" : "answer hidden") : "no answer on this screen";
    projectorStatus.textContent = link.isConnected()
      ? `Projector connected · ${state.blanked ? "blanked" : answerText}`
      : "Projector not connected";
    projectorStatus.classList.toggle("connected", link.isConnected());
  }

  // ---------- state changes ----------
  function currentSnapshot(now = Date.now()) {
    const step = currentStep(plan, state);
    const footer = isSequence ? `${title} · Step ${state.stepIndex + 1} of ${plan.steps.length}` : title;
    const timer = isSequence && state.showTimerOnDisplay
      ? { running: isRunning(state.timers[state.stepIndex]), remainingSeconds: remainingMs(step.minutes, state.timers[state.stepIndex], now) / 1000 }
      : null;
    return buildDisplaySnapshot({ module: step.module, stage: currentStage(plan, state), revealed: state.revealed, blanked: state.blanked, footer, timer });
  }

  function apply(newState) {
    if (newState === state) return;
    state = newState;
    if (state.stepIndex !== renderedStepIndex) renderStepStatic();
    link.send(currentSnapshot());
    renderDynamic();
    saveState(storageKey, state);
    if (isSequence) {
      const hash = buildHash({ name: "lead", sequenceId: options.sequence.id, stepNumber: state.stepIndex + 1, shortOnTime: state.shortOnTime });
      if (location.hash !== hash) history.replaceState(null, "", hash);
    }
  }

  function handleKey(key) {
    if (key === "ArrowRight") apply(goNext(plan, state, Date.now()));
    else if (key === "ArrowLeft") apply(goBack(plan, state, Date.now()));
    else if (key === " " && isSequence) apply(toggleTimer(state, Date.now()));
    else if (key === "r" || key === "R") apply(toggleReveal(plan, state));
    else if (key === "b" || key === "B") apply(toggleBlank(state));
    else return false;
    return true;
  }

  function onKeyDown(event) {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const target = event.target;
    const tag = target?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
    // Space and Enter on a focused button or link should press it, not drive the meeting.
    if ((event.key === " " || event.key === "Enter") && (tag === "BUTTON" || tag === "A" || tag === "SUMMARY")) return;
    if (handleKey(event.key)) event.preventDefault();
  }

  // ---------- start ----------
  renderStepStatic();
  link.send(currentSnapshot());
  renderDynamic();
  if (isSequence) {
    const hash = buildHash({ name: "lead", sequenceId: options.sequence.id, stepNumber: state.stepIndex + 1, shortOnTime: state.shortOnTime });
    if (location.hash !== hash) history.replaceState(null, "", hash);
  }

  document.addEventListener("keydown", onKeyDown);
  const unsubscribeLink = link.subscribe({
    onKey: handleKey,
    onStatusChange: renderProjectorStatus,
    onDisplayReady: renderProjectorStatus
  });
  const ticker = setInterval(() => renderTimer(Date.now()), 1000);

  return function stopPresenterView() {
    document.removeEventListener("keydown", onKeyDown);
    unsubscribeLink();
    clearInterval(ticker);
  };
}

// ---------- plans ----------

function buildSequencePlan(sequence, content) {
  return {
    steps: sequence.steps.map((step) => {
      const module = content.modules.get(step.moduleId);
      return { module, minutes: step.minutes, optional: Boolean(step.optional), stages: buildStages(module) };
    })
  };
}

function buildModulePlan(module) {
  return { steps: [{ module, minutes: module.durationMinutes, optional: false, stages: buildStages(module) }] };
}

function renderUsedIn(moduleId, content) {
  const uses = [];
  for (const sequence of content.sequences.values()) {
    sequence.steps.forEach((step, index) => {
      if (step.moduleId === moduleId) uses.push({ sequence, stepNumber: index + 1 });
    });
  }
  if (!uses.length) return null;
  return makeElement("p", { className: "card-meta" }, [
    "Used in: ",
    ...uses.flatMap(({ sequence, stepNumber }, index) => [
      index ? " · " : "",
      makeElement("a", { text: `${sequence.title}, step ${stepNumber}`, attributes: { href: buildHash({ name: "lead", sequenceId: sequence.id, stepNumber }) } })
    ])
  ]);
}

// ---------- saving between page loads ----------
// Only the meeting's position, toggles and timers are saved, in this browser only.
// Reveal and blank aren't saved: after a reload the answer is hidden again.

function restoreState(plan, storageKey, route) {
  let state = createSession(plan);
  if (storageKey) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (saved && Array.isArray(saved.timers) && saved.timers.length === plan.steps.length) {
        state = {
          ...state,
          stepIndex: Math.min(Math.max(0, saved.stepIndex | 0), plan.steps.length - 1),
          stageIndex: 0,
          shortOnTime: Boolean(saved.shortOnTime),
          showTimerOnDisplay: Boolean(saved.showTimerOnDisplay),
          timers: saved.timers.map((timer) => ({ elapsedMs: Number(timer.elapsedMs) || 0, runningSince: typeof timer.runningSince === "number" ? timer.runningSince : null })),
          meetingStartedAt: typeof saved.meetingStartedAt === "number" ? saved.meetingStartedAt : null
        };
        const savedStage = saved.stageIndex | 0;
        if (savedStage < plan.steps[state.stepIndex].stages.length) state.stageIndex = savedStage;
      }
    } catch {
      // A damaged save is ignored; the meeting starts fresh.
    }
  }
  if (route?.stepGiven) {
    const wanted = Math.min(Math.max(0, route.stepNumber - 1), plan.steps.length - 1);
    if (wanted !== state.stepIndex) state = { ...state, stepIndex: wanted, stageIndex: 0 };
  }
  if (route && typeof route.shortOnTime === "boolean") state = setShortOnTime(state, route.shortOnTime);
  return state;
}

function saveState(storageKey, state) {
  if (!storageKey) return;
  try {
    const { stepIndex, stageIndex, shortOnTime, showTimerOnDisplay, timers, meetingStartedAt } = state;
    localStorage.setItem(storageKey, JSON.stringify({ stepIndex, stageIndex, shortOnTime, showTimerOnDisplay, timers, meetingStartedAt }));
  } catch {
    // Private browsing can refuse storage; the meeting still runs, it just won't survive a reload.
  }
}
