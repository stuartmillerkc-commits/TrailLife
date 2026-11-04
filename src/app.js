// Phase 0 placeholder app: lists the modules and facts found in /content.
// Phase 1 replaces this with the router, navigator and presenter (PLAN.md section 4).
//
// Kept as a single file on purpose for now: scripts/build-single-file.js inlines
// it as-is. Once the app is split into several modules, Phase 7 extends the build.

// Load one content file, e.g. "facts/branches.json".
// In the offline single-file build, every content file is embedded in the page
// inside <script type="application/json" id="embedded-content">, so no network is needed.
const embeddedContentElement = document.getElementById("embedded-content");
const embeddedContent = embeddedContentElement ? JSON.parse(embeddedContentElement.textContent) : null;

async function loadContentFile(relativePath) {
  if (embeddedContent) {
    if (!(relativePath in embeddedContent)) throw new Error(`${relativePath} isn't in this offline build`);
    return embeddedContent[relativePath];
  }
  const response = await fetch(`content/${relativePath}`);
  if (!response.ok) throw new Error(`Couldn't load content/${relativePath} (${response.status})`);
  return response.json();
}

function makeElement(tag, { className, text } = {}, children = []) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  children.forEach((child) => element.appendChild(child));
  return element;
}

function showError(listElement, message) {
  listElement.replaceChildren(makeElement("li", { className: "error-message", text: message }));
}

function renderModules(modules, listElement) {
  if (modules.length === 0) { listElement.replaceChildren(makeElement("li", { text: "No modules yet." })); return; }
  listElement.replaceChildren(...modules.map((module) => {
    const requirementText = module.requirements.length ? `Requirement ${module.requirements.join(", ")}` : "No requirement";
    // Only boy-safe fields here: never leaderScript, answers or reveal text.
    return makeElement("li", {}, [
      makeElement("h3", { text: module.title }),
      makeElement("p", { className: "card-meta", text: `${requirementText} · ${module.durationMinutes} min · ${module.activityType.join(", ")}` }),
      makeElement("p", { text: module.displayContent.headline })
    ]);
  }));
}

function renderFacts(facts, listElement) {
  if (facts.length === 0) { listElement.replaceChildren(makeElement("li", { text: "No facts yet." })); return; }
  listElement.replaceChildren(...facts.map((fact) => {
    const sourceParagraph = makeElement("p", { className: "card-meta" });
    if (fact.source) {
      const link = makeElement("a", { text: fact.source.title });
      link.href = fact.source.url;
      link.target = "_blank";
      link.rel = "noopener";
      sourceParagraph.append("Source: ", link, ` · verified ${fact.verifiedOn}`);
    } else {
      sourceParagraph.textContent = fact.sourceId ? `Source: ${fact.sourceId}` : "Needs verification";
    }
    return makeElement("li", {}, [makeElement("p", { text: fact.statement }), sourceParagraph]);
  }));
}

async function start() {
  const moduleList = document.getElementById("module-list");
  const factList = document.getElementById("fact-list");
  try {
    const { files } = await loadContentFile("index.json");
    const moduleFiles = files.filter((file) => file.startsWith("modules/"));
    const factFiles = files.filter((file) => file.startsWith("facts/"));
    const modules = await Promise.all(moduleFiles.map(loadContentFile));
    const factGroups = await Promise.all(factFiles.map(loadContentFile));
    renderModules(modules, moduleList);
    renderFacts(factGroups.flat(), factList);
  } catch (error) {
    const message = `${error.message}. If you opened index.html by double-clicking it, run \`npm start\` and use http://localhost:8000 instead.`;
    showError(moduleList, message);
    showError(factList, message);
  }
}

start();
