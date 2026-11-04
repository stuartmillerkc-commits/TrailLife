// The site's starting point. It reads the address after "#" and shows the matching page.
//
// Two kinds of window:
//   - the display (projector) window, #/display: loads no content at all, only shows
//     what the leader window sends it (src/views/display-view.js)
//   - every other page is the leader window: loads the content and drives the display
//
// See src/router.js for the list of addresses.

import { parseHash } from "./router.js";
import { startDisplayView } from "./views/display-view.js";
import { loadAllContent } from "./content/content-loader.js";
import { createLeaderLink } from "./presenter/display-channel.js";
import { buildIdleSnapshot } from "./presenter/display-snapshot.js";
import { startPresenterView } from "./views/presenter-view.js";
import { renderError, renderHome, renderLibrary, renderMeetings, renderNotFound } from "./views/home-views.js";

const root = document.getElementById("app");

async function start() {
  // The projector window takes a separate path, before any content is loaded.
  if (parseHash(location.hash).name === "display") {
    startDisplayView(root);
    return;
  }

  let content;
  try {
    content = await loadAllContent();
  } catch (error) {
    renderError(root, `${error.message}. If you opened index.html by double-clicking it, run “npm start” and use http://localhost:8000 instead, or use the offline file from “npm run build”.`);
    return;
  }

  const link = createLeaderLink();
  window.addEventListener("pagehide", () => link.close());
  let stopCurrentView = null;

  function showRoute() {
    if (stopCurrentView) { stopCurrentView(); stopCurrentView = null; }
    const route = parseHash(location.hash);

    if (route.name === "display") { location.reload(); return; } // switching this window into projector mode
    if (route.name === "lead") {
      const sequence = content.sequences.get(route.sequenceId);
      if (!sequence) { link.send(buildIdleSnapshot()); renderNotFound(root, `There’s no meeting called “${route.sequenceId}”.`); return; }
      stopCurrentView = startPresenterView(root, { mode: "sequence", sequence, route, content, link });
    } else if (route.name === "module") {
      const module = content.modules.get(route.moduleId);
      if (!module) { link.send(buildIdleSnapshot()); renderNotFound(root, `There’s no module called “${route.moduleId}”.`); return; }
      stopCurrentView = startPresenterView(root, { mode: "module", module, route, content, link });
    } else {
      link.send(buildIdleSnapshot()); // nothing to project on these pages
      if (route.name === "home") renderHome(root, content);
      else if (route.name === "meetings") renderMeetings(root, content);
      else if (route.name === "library") renderLibrary(root, content);
      else renderNotFound(root, "That address doesn’t match any page.");
    }
    document.getElementById("main")?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", showRoute);
  showRoute();
}

start();
