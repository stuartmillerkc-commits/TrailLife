// Draws a projector snapshot (from display-snapshot.js) into a container.
// Used by the display window AND by the leader's "projector preview", so the leader
// sees exactly what the boys see. It draws only what's in the snapshot.

import { makeElement } from "./dom.js";
import { formatClock } from "../presenter/timer.js";

// options.timerNow: for a running timer, the current time, so the countdown can be drawn
// between messages. Pass the moment the snapshot arrived as options.receivedAt.
export function renderDisplaySnapshot(container, snapshot, { waitingText = "Waiting for the leader window…", receivedAt = Date.now(), timerNow = Date.now() } = {}) {
  container.replaceChildren();
  container.classList.toggle("is-blank", Boolean(snapshot?.blanked));

  if (!snapshot) {
    container.append(makeElement("p", { className: "display-waiting", text: waitingText }));
    return;
  }
  if (snapshot.blanked) return; // blank: draw nothing at all
  if (!snapshot.screen) {
    // The leader is on a page with nothing to project (home, library).
    container.append(makeElement("p", { className: "display-idle", text: "Military Heritage Trail Badge" }));
    return;
  }

  const { screen } = snapshot;
  const card = makeElement("div", { className: "display-card" }, [
    screen.kicker ? makeElement("p", { className: "display-kicker", text: screen.kicker }) : null,
    makeElement("h1", { className: "display-headline", text: screen.headline }),
    screen.body ? makeElement("p", { className: "display-body", text: screen.body }) : null,
    screen.points.length ? makeElement("ul", { className: "display-points" }, screen.points.map((point) => makeElement("li", { text: point }))) : null,
    screen.answer ? renderAnswer(screen.answer) : null
  ]);

  const footer = makeElement("div", { className: "display-footer" }, [
    makeElement("span", { text: screen.footer }),
    makeElement("span", { text: screen.progress }),
    snapshot.timer ? makeElement("span", { className: "display-timer", text: formatClock(displayRemainingMs(snapshot.timer, receivedAt, timerNow)) }) : null
  ]);

  container.append(card, footer);
}

// Seconds left on a timer shown on screen, counting down locally while it runs.
export function displayRemainingMs(timer, receivedAt, now) {
  const remaining = timer.remainingSeconds * 1000;
  return timer.running ? remaining - Math.max(0, now - receivedAt) : remaining;
}

// Also used by the leader view to show the answer before it's revealed.
export function renderAnswer(answer) {
  const box = makeElement("div", { className: "display-answer", attributes: { role: "status" } });
  if (answer.title) box.append(makeElement("h2", { text: answer.title }));
  if (answer.type === "text") box.append(makeElement("p", { text: answer.text }));
  if (answer.type === "list") box.append(makeElement("ol", {}, answer.items.map((item) => makeElement("li", { text: item }))));
  if (answer.type === "table" && answer.table) {
    const head = makeElement("thead", {}, [makeElement("tr", {}, answer.table.columns.map((column) => makeElement("th", { text: column, attributes: { scope: "col" } })))]);
    const body = makeElement("tbody", {}, answer.table.rows.map((cells) => makeElement("tr", {}, cells.map((cell) => makeElement("td", { text: cell })))));
    box.append(makeElement("table", {}, [head, body]));
  }
  return box;
}
