// Builds the one message the leader window sends the projector window: a complete
// snapshot of what the boys should see right now.
//
// THIS IS THE ONLY PLACE PROJECTOR CONTENT IS MADE. Rules that keep answers safe:
//   - Copy fields by name. Never spread a module object ({ ...module }), so leader
//     script, discussion answers, ifShortOnTime and notes can't slip through.
//   - "answer" is filled only when the leader has revealed the current stage.
//   - When the projector is blanked, "screen" is null: nothing to hide, because nothing is sent.
// tests/display-snapshot.test.js checks every module in /content against these rules.

export const DISPLAY_PROTOCOL_VERSION = 1;

// input: {
//   module, stage (from buildStages), revealed, blanked,
//   footer: "Meeting 1 — Who Serves · Step 3 of 7",
//   timer: null or { running, remainingSeconds }   (only when the leader shows the timer on screen)
// }
// Returns the snapshot without the message envelope; the display channel adds sessionId and messageNumber.
export function buildDisplaySnapshot({ module, stage, revealed = false, blanked = false, footer = "", timer = null }) {
  if (blanked || !module || !stage) {
    return { type: "screen", protocol: DISPLAY_PROTOCOL_VERSION, blanked: Boolean(blanked), screen: null, timer: null };
  }

  const display = module.displayContent || {};
  const screen = {
    kicker: "",
    headline: "",
    body: "",
    points: [],
    footer: String(footer),
    progress: "",
    answer: null
  };

  if (stage.kind === "intro") {
    screen.headline = String(display.headline || module.title || "");
    screen.body = String(display.body || "");
    screen.points = (display.points || []).map(String);
    if (revealed && stage.hasAnswer && module.reveal) screen.answer = copyAnswerKey(module.reveal);
  } else if (stage.kind === "prompt") {
    const prompt = module.prompts[stage.promptIndex];
    screen.kicker = String(display.headline || module.title || "");
    screen.headline = String(prompt.text);
    screen.progress = String(stage.label);
    if (revealed) screen.answer = { type: "text", title: "", text: String(prompt.answer) };
  } else if (stage.kind === "answer-key") {
    screen.kicker = String(display.headline || module.title || "");
    screen.headline = String(module.reveal?.title || "Answer key");
    if (revealed && module.reveal) screen.answer = copyAnswerKey(module.reveal, { includeTitle: false });
  }

  return {
    type: "screen",
    protocol: DISPLAY_PROTOCOL_VERSION,
    blanked: false,
    screen,
    timer: timer ? { running: Boolean(timer.running), remainingSeconds: Math.round(Number(timer.remainingSeconds) || 0) } : null
  };
}

// What the projector shows on pages with nothing to project (home, library): a title card.
export function buildIdleSnapshot() {
  return { type: "screen", protocol: DISPLAY_PROTOCOL_VERSION, blanked: false, screen: null, timer: null };
}

// The answer key, copied field by field. Fact ids are left behind: the projector doesn't need them.
function copyAnswerKey(reveal, { includeTitle = true } = {}) {
  const answer = { type: String(reveal.type), title: includeTitle ? String(reveal.title || "") : "" };
  if (reveal.type === "text") answer.text = String(reveal.text || "");
  if (reveal.type === "list") answer.items = (reveal.items || []).map(String);
  if (reveal.type === "table" && reveal.table) {
    answer.table = {
      columns: reveal.table.columns.map(String),
      rows: reveal.table.rows.map((row) => row.cells.map(String))
    };
  }
  return answer;
}
