// The projector window (#/display). It loads NO content files: everything it shows
// arrives from the leader window as snapshots, so answers can't be here before the
// leader reveals them. tests/display-isolation.test.js checks this file's imports.

import { createDisplayLink, FORWARDED_KEYS } from "../presenter/display-channel.js";
import { renderDisplaySnapshot } from "./display-renderer.js";
import { makeElement } from "./dom.js";

export function startDisplayView(root) {
  document.body.className = "display-mode";
  document.title = "Projector — Military Heritage";

  const stage = makeElement("main", { className: "display-stage", attributes: { id: "main", "aria-live": "polite" } });
  const fullScreenButton = makeElement("button", {
    className: "display-fullscreen",
    text: "Full screen (F)",
    attributes: { type: "button" },
    onClick: toggleFullScreen
  });
  root.replaceChildren(stage, fullScreenButton);

  let snapshot = null;
  let receivedAt = Date.now();
  const draw = () => renderDisplaySnapshot(stage, snapshot, { receivedAt, timerNow: Date.now() });

  const link = createDisplayLink({
    onScreen: (message) => { snapshot = message; receivedAt = Date.now(); draw(); },
    onGoodbye: () => { snapshot = null; draw(); }
  });
  draw();
  link.announceReady();

  // Redraw once a second so an on-screen timer counts down between messages.
  setInterval(() => { if (snapshot?.timer?.running) draw(); }, 1000);

  // Keys pressed on the projector window are passed to the leader window, so the leader
  // can keep driving after clicking here to go full screen. F is handled here.
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === "f" || event.key === "F") { toggleFullScreen(); return; }
    if (FORWARDED_KEYS.includes(event.key)) {
      event.preventDefault();
      link.forwardKey(event.key);
    }
  });

  document.addEventListener("fullscreenchange", () => {
    fullScreenButton.hidden = Boolean(document.fullscreenElement);
  });
}

function toggleFullScreen() {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}
