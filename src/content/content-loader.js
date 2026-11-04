// Loads lesson content from /content. Used by the LEADER window only.
// The display (projector) window never imports this file; it gets everything it shows
// from the leader as snapshots. tests/display-isolation.test.js checks that.
//
// In the offline single-file build, every content file is embedded in the page inside
// <script type="application/json" id="embedded-content">, so no network is needed.

let embeddedContent;

function readEmbeddedContent() {
  if (embeddedContent === undefined) {
    const element = document.getElementById("embedded-content");
    embeddedContent = element ? JSON.parse(element.textContent) : null;
  }
  return embeddedContent;
}

// Load one content file, e.g. "facts/branches.json".
export async function loadContentFile(relativePath) {
  const embedded = readEmbeddedContent();
  if (embedded) {
    if (!(relativePath in embedded)) throw new Error(`${relativePath} isn’t in this offline build`);
    return embedded[relativePath];
  }
  const response = await fetch(`content/${relativePath}`);
  if (!response.ok) throw new Error(`Couldn’t load content/${relativePath} (${response.status})`);
  return response.json();
}

// Load everything and index it by id: { modules, sequences, facts, sources } as Maps.
export async function loadAllContent() {
  const { files } = await loadContentFile("index.json");
  const inFolder = (folder) => files.filter((file) => file.startsWith(`${folder}/`));

  const [moduleList, sequenceList, factGroups, sourceList] = await Promise.all([
    Promise.all(inFolder("modules").map(loadContentFile)),
    Promise.all(inFolder("sequences").map(loadContentFile)),
    Promise.all(inFolder("facts").map(loadContentFile)),
    files.includes("sources/sources.json") ? loadContentFile("sources/sources.json") : []
  ]);

  const byId = (records) => new Map(records.map((record) => [record.id, record]));
  return {
    modules: byId(moduleList),
    sequences: byId(sequenceList),
    facts: byId(factGroups.flat()),
    sources: byId(sourceList)
  };
}
