#!/usr/bin/env node
// Content and accuracy check. Run with `npm run check`.
//
// What it enforces (CLAUDE.md "Accuracy rules"):
//   1. Every content file is valid JSON and matches its schema (see schemas/schema-map.json).
//   2. Every fact has a source with a web address and a verifiedOn date, unless it's
//      marked needsVerification: true. Those are listed as warnings (errors with --strict).
//   3. Source disagreements list each version with its own source and say which one the site shows.
//   4. Every factId, sourceId, moduleId and unit id that content mentions actually exists.
//   5. Battles: every phase cites its sources; the battle has a "positions approximate" line;
//      units, sides and the grid are consistent.
//   6. What-ifs: a confidence label, sourced reasoning, a fork at a real decision point, and
//      no invented casualty figures (warning).
//   7. Images that are re-hosted have a license and a local file.
//
// Usage:
//   node scripts/check-sources.js              check /content
//   node scripts/check-sources.js --strict     also fail on needsVerification items (use before an offline build)
//   node scripts/check-sources.js --content tests/fixtures/failing-fact/content
//
// Exit code 0 means passed; 1 means at least one error.

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SchemaLibrary } from "./lib/json-schema-lite.js";
import {
  CONTENT_INDEX_FILE, DEFAULT_CONTENT_DIRECTORY, SCHEMA_DIRECTORY,
  listContentFiles, loadSchemaMap, schemaForFile
} from "./lib/content-files.js";

// Keys whose values point at other records. The check follows every one of them, wherever it appears.
const FACT_REFERENCE_KEYS = new Set(["factId", "factIds", "reasoningFactIds"]);
const SOURCE_REFERENCE_KEYS = new Set(["sourceId", "sourceIds", "reasoningSourceIds", "historianSourceIds"]);
const MODULE_REFERENCE_KEYS = new Set(["moduleId"]);

// Reader-facing text fields. Straight quotes in these get a warning, because the site uses ’ “ ”.
const READER_TEXT_KEYS = new Set([
  "statement", "title", "headline", "body", "narration", "teaser", "prompt", "who", "choices",
  "historicalOutcome", "question", "answer", "leaderScript", "discussion", "captureTheFlag", "label",
  "caption", "altText", "situation", "mission", "commandersIntent", "signals", "task", "role", "note",
  "notes", "change", "reasoning", "clue", "ifShortOnTime", "lowVolunteerNote", "siteDisplays",
  "teachingNote", "leaderNote", "positionsDisclaimer", "approximateNote", "closingPrompt", "materials",
  "strengthNote", "sourceNote", "name", "text", "category", "cells", "points", "items", "columns", "promptLabel"
]);

// Looks like a made-up casualty figure, e.g. "about 300 killed" or "1,200 casualties".
const CASUALTY_FIGURE_PATTERN = /\b\d[\d,]*\s+(?:men\s+)?(?:casualties|killed|wounded|captured|dead|lost|losses|prisoners)\b/i;

export function runCheck({ contentDirectory = DEFAULT_CONTENT_DIRECTORY, strict = false, today = localDateString() } = {}) {
  const repoRoot = path.dirname(contentDirectory); // localFile paths ("sources/…", "assets/…") are relative to this
  // How file locations appear in messages: "content" normally, or e.g. "tests/fixtures/failing-fact/content".
  const contentLabel = path.relative(process.cwd(), contentDirectory).split(path.sep).join("/") || "content";
  const errors = [];
  const warnings = [];
  const needsVerification = [];
  const addError = (where, message) => errors.push({ where, message });
  const addWarning = (where, message) => warnings.push({ where, message });

  const schemaMap = loadSchemaMap();
  const schemas = new SchemaLibrary(SCHEMA_DIRECTORY);

  // ---------- 1. Load and validate every file ----------
  const contentPaths = existsSync(contentDirectory) ? listContentFiles(contentDirectory) : [];
  if (contentPaths.length === 0) addError("content", `No content files found in ${contentDirectory}`);

  const loaded = new Map(); // relative path -> parsed JSON
  for (const relativePath of contentPaths) {
    const where = `${contentLabel}/${relativePath}`;
    let data;
    try {
      data = JSON.parse(readFileSync(path.join(contentDirectory, relativePath), "utf8"));
    } catch (parseError) {
      addError(where, `isn't valid JSON: ${parseError.message}. Look for a missing comma or quote near that spot.`);
      continue;
    }
    loaded.set(relativePath, data);
    const schemaFile = schemaForFile(relativePath, schemaMap);
    if (!schemaFile) {
      addWarning(where, "no schema covers this file, so it wasn't checked. Add it to schemas/schema-map.json if it's real content.");
      continue;
    }
    for (const problem of schemas.validate(data, schemaFile)) {
      addError(describeLocation(where, data, problem.path), `${problem.path || "file"} ${problem.message}`);
    }
  }

  // ---------- 2. Build registries of everything that has an id ----------
  const facts = new Map();     // id -> { record, where }
  const sources = new Map();
  const modules = new Map();
  const games = new Map();
  const images = new Map();
  const sequences = new Map();

  function register(registry, kind, record, where) {
    if (!record || typeof record.id !== "string") return;
    if (registry.has(record.id)) {
      addError(where, `${kind} id "${record.id}" is used twice (also in ${registry.get(record.id).where}). Ids must be unique.`);
      return;
    }
    registry.set(record.id, { record, where });
  }

  for (const [relativePath, data] of loaded) {
    const where = `${contentLabel}/${relativePath}`;
    const folder = relativePath.split("/")[0];
    const fileStem = path.posix.basename(relativePath, ".json");
    if (folder === "facts" && Array.isArray(data)) data.forEach((fact, index) => register(facts, "Fact", fact, `${where} [${index}]`));
    if (relativePath === "sources/sources.json" && Array.isArray(data)) data.forEach((source, index) => register(sources, "Source", source, `${where} [${index}]`));
    if (relativePath === "images/manifest.json" && Array.isArray(data)) data.forEach((image, index) => register(images, "Image", image, `${where} [${index}]`));
    if (folder === "modules" && isObject(data)) {
      register(modules, "Module", data, where);
      if (data.id && data.id !== fileStem) addError(where, `module id "${data.id}" should match the file name "${fileStem}".`);
    }
    if (folder === "games" && isObject(data)) register(games, "Game", data, where);
    if (folder === "sequences" && isObject(data)) register(sequences, "Sequence", data, where);
  }

  // ---------- 3. Facts: the core accuracy rule ----------
  for (const [factId, { record: fact, where }] of facts) {
    const label = `${where} (fact "${factId}")`;
    if (fact.source && fact.sourceId) addError(label, `has both "source" and "sourceId". Use one.`);
    if (fact.needsVerification === true) {
      needsVerification.push({ where: label, message: fact.statement });
      if (strict) addError(label, "is marked needsVerification. Verify it (add source and verifiedOn, remove needsVerification) or take it out of the content.");
    } else {
      const sourceUrl = fact.source?.url || sources.get(fact.sourceId)?.record.url;
      if (!fact.source && !fact.sourceId) {
        addError(label, `has no source. Add "source": { "title": …, "url": … } or a "sourceId" from content/sources/sources.json. If nobody can confirm it yet, set "needsVerification": true instead of guessing.`);
      } else if (!sourceUrl && sources.has(fact.sourceId)) {
        addError(label, `its source "${fact.sourceId}" has no url.`);
      }
      if (!fact.verifiedOn) {
        addError(label, `has no "verifiedOn" date. Add the date (YYYY-MM-DD) you checked it against the source.`);
      } else if (fact.verifiedOn > today) {
        addError(label, `verifiedOn ${fact.verifiedOn} is in the future.`);
      }
    }
    for (const [index, alternative] of (fact.disagreement?.alternatives || []).entries()) {
      if (!alternative.source && !alternative.sourceId) {
        addError(label, `disagreement alternative ${index + 1} ("${alternative.statement}") needs its own source or sourceId.`);
      }
    }
  }

  // ---------- 4. Follow every reference in every file ----------
  for (const [relativePath, data] of loaded) {
    const where = `${contentLabel}/${relativePath}`;
    walkValues(data, (key, value, valuePath) => {
      const ids = Array.isArray(value) ? value.filter((item) => typeof item === "string") : (typeof value === "string" ? [value] : []);
      const at = describeLocation(where, data, valuePath);
      if (FACT_REFERENCE_KEYS.has(key)) {
        ids.forEach((id) => { if (!facts.has(id)) addError(at, `refers to fact "${id}", which doesn't exist in content/facts.`); });
      } else if (SOURCE_REFERENCE_KEYS.has(key)) {
        ids.forEach((id) => { if (!sources.has(id)) addError(at, `refers to source "${id}", which isn't in content/sources/sources.json.`); });
      } else if (MODULE_REFERENCE_KEYS.has(key)) {
        ids.forEach((id) => { if (!modules.has(id)) addError(at, `refers to module "${id}", which doesn't exist in content/modules.`); });
      } else if (key === "linkedGames") {
        ids.forEach((id) => { if (!games.has(id)) addWarning(at, `links to game "${id}", which doesn't exist yet.`); });
      } else if (key === "images" && valuePath.endsWith("displayContent.images")) {
        ids.forEach((id) => { if (!images.has(id)) addWarning(at, `shows image "${id}", which isn't in content/images/manifest.json yet.`); });
      }
      if (READER_TEXT_KEYS.has(key)) {
        const texts = Array.isArray(value) ? value.filter((item) => typeof item === "string") : (typeof value === "string" ? [value] : []);
        texts.forEach((text) => {
          if (/['"]/.test(text)) addWarning(at, `uses a straight quote or apostrophe. Reader-facing text uses ’ “ ” instead: "${truncate(text, 60)}"`);
        });
      }
    });
  }

  // ---------- 5. Sources, images and sequences ----------
  for (const [sourceId, { record: source, where }] of sources) {
    if (source.localFile && !existsSync(path.join(repoRoot, source.localFile))) {
      addWarning(`${where} (source "${sourceId}")`, `local copy ${source.localFile} is missing. See sources/README.md for the download link.`);
    }
  }
  for (const [imageId, { record: image, where }] of images) {
    if (image.rehostAllowed && image.localFile && !existsSync(path.join(repoRoot, image.localFile))) {
      addError(`${where} (image "${imageId}")`, `rehostAllowed is true but ${image.localFile} doesn't exist.`);
    }
  }
  // Answers shown on the projector must trace to facts: every prompt and every answer-key row names its fact.
  for (const [moduleId, { record: module, where }] of modules) {
    (module.prompts || []).forEach((prompt, index) => {
      if (!prompt.factIds?.length) addError(`${where} (module "${moduleId}")`, `prompt ${index + 1} ("${truncate(prompt.text, 40)}") has no factIds. Its answer must point to the fact that backs it.`);
    });
    (module.reveal?.table?.rows || []).forEach((row, index) => {
      if (!row.factIds?.length) addError(`${where} (module "${moduleId}")`, `answer-key row ${index + 1} ("${truncate(row.cells.join(" · "), 40)}") has no factIds.`);
    });
    if (module.reveal?.table && module.reveal.table.rows.some((row) => row.cells.length !== module.reveal.table.columns.length)) {
      addError(`${where} (module "${moduleId}")`, "every answer-key row needs one cell per column.");
    }
    const afterPrompt = module.reveal?.afterPrompt;
    if (afterPrompt !== undefined && (!module.prompts?.length || afterPrompt > module.prompts.length)) {
      addError(`${where} (module "${moduleId}")`, `reveal.afterPrompt is ${afterPrompt}, but the module has ${module.prompts?.length || 0} prompt(s). Use 0 to ${module.prompts?.length || 0}, or remove it.`);
    }
    // Anything on the projector that rests on an unverified fact gets a warning, so a leader can decide before the meeting.
    const projectorFactIds = [
      ...(module.prompts || []).flatMap((prompt) => prompt.factIds || []),
      ...(module.reveal?.factIds || []),
      ...(module.reveal?.table?.rows || []).flatMap((row) => row.factIds || [])
    ];
    [...new Set(projectorFactIds)].filter((factId) => facts.get(factId)?.record.needsVerification).forEach((factId) => {
      addWarning(`${where} (module "${moduleId}")`, `shows an answer on the projector that rests on unverified fact "${factId}".`);
    });
  }
  for (const [sequenceId, { record: sequence, where }] of sequences) {
    const stepMinutes = (sequence.steps || []).reduce((total, step) => total + (step.minutes || 0), 0);
    if (sequence.totalMinutes && stepMinutes !== sequence.totalMinutes) {
      addWarning(`${where} (sequence "${sequenceId}")`, `steps add up to ${stepMinutes} minutes, but totalMinutes is ${sequence.totalMinutes}.`);
    }
  }

  // ---------- 6. Battles ----------
  const battleFolders = [...new Set(contentPaths.filter((p) => p.startsWith("battles/")).map((p) => p.split("/")[1]))];
  for (const battleFolder of battleFolders) {
    checkBattle(battleFolder, (name) => loaded.get(`battles/${battleFolder}/${name}`), { addError, addWarning, needsVerification, strict, contentLabel });
  }

  // ---------- 7. The generated content index must be current ----------
  const indexPath = path.join(contentDirectory, CONTENT_INDEX_FILE);
  if (existsSync(indexPath)) {
    try {
      const listed = JSON.parse(readFileSync(indexPath, "utf8")).files || [];
      if (JSON.stringify(listed) !== JSON.stringify(contentPaths)) {
        addError(`${contentLabel}/${CONTENT_INDEX_FILE}`, "is out of date (files were added, renamed or removed). Run `npm run index`.");
      }
    } catch {
      addError(`${contentLabel}/${CONTENT_INDEX_FILE}`, "isn't valid JSON. Run `npm run index` to rebuild it.");
    }
  }

  return {
    errors, warnings, needsVerification,
    stats: { files: contentPaths.length, facts: facts.size, sources: sources.size, modules: modules.size, games: games.size, sequences: sequences.size, images: images.size, battles: battleFolders.length }
  };
}

function checkBattle(battleFolder, file, { addError, addWarning, needsVerification, strict, contentLabel }) {
  const base = `${contentLabel}/battles/${battleFolder}`;
  const battle = file("battle.json");
  const units = file("units.json");
  const phases = file("phases.json");
  for (const [name, data] of [["battle.json", battle], ["units.json", units], ["phases.json", phases]]) {
    if (!data) addError(base, `is missing ${name}. Every battle needs battle.json, units.json and phases.json.`);
  }
  if (!isObject(battle) || !Array.isArray(units) || !Array.isArray(phases)) return;

  if (battle.id !== battleFolder) addError(`${base}/battle.json`, `id "${battle.id}" should match the folder name "${battleFolder}".`);

  const sideIds = new Set((battle.sides || []).map((side) => side.id));
  const subgroupIds = new Set((battle.sides || []).flatMap((side) => (side.subgroups || []).map((subgroup) => subgroup.id)));
  const unitsById = new Map(units.map((unit) => [unit.id, unit]));
  const checkSide = (where, side) => { if (side !== undefined && !sideIds.has(side)) addError(where, `side "${side}" isn't one of this battle's sides (${[...sideIds].join(", ")}).`); };
  const checkUnit = (where, unitId) => { if (!unitsById.has(unitId)) addError(where, `unit "${unitId}" isn't in units.json.`); };

  // Grid must tile the field exactly, so grid squares on screen match the sand table.
  const { field, grid } = battle;
  if (field && grid) {
    if (grid.columns * grid.cellSize !== field.width) addError(`${base}/battle.json`, `grid.columns × grid.cellSize (${grid.columns} × ${grid.cellSize}) should equal field.width (${field.width}).`);
    if (grid.rows * grid.cellSize !== field.height) addError(`${base}/battle.json`, `grid.rows × grid.cellSize (${grid.rows} × ${grid.cellSize}) should equal field.height (${field.height}).`);
  }

  const seenUnitIds = new Set();
  units.forEach((unit, index) => {
    const where = `${base}/units.json [${index}] (unit "${unit.id}")`;
    if (seenUnitIds.has(unit.id)) addError(where, "unit id is used twice.");
    seenUnitIds.add(unit.id);
    checkSide(where, unit.side);
    if (unit.subgroup && !subgroupIds.has(unit.subgroup)) addError(where, `subgroup "${unit.subgroup}" isn't defined in battle.json sides[].subgroups.`);
  });

  phases.forEach((phase, position) => {
    const where = `${base}/phases.json [${position}] (phase "${phase.title}")`;
    if (phase.index !== position) addError(where, `index is ${phase.index} but it's phase number ${position} in the list. Keep indexes 0, 1, 2… in order.`);
    for (const [unitId, change] of Object.entries(phase.units || {})) {
      checkUnit(where, unitId);
      const [x, y] = change.position || [];
      if (field && change.position && change.status !== "gone" && (x < 0 || y < 0 || x > field.width || y > field.height)) {
        addWarning(where, `unit "${unitId}" is placed at [${x}, ${y}], outside the ${field.width} × ${field.height} field. Mark it "status": "gone" if it's off the map.`);
      }
    }
    (phase.movements || []).forEach((movement) => { checkSide(where, movement.side); if (movement.unitId) checkUnit(where, movement.unitId); });
    for (const [sideId, hiddenUnitIds] of Object.entries(phase.hiddenFrom || {})) {
      checkSide(where, sideId);
      hiddenUnitIds.forEach((unitId) => {
        checkUnit(where, unitId);
        if (unitsById.get(unitId)?.side === sideId) addWarning(where, `hides "${unitId}" from its own side "${sideId}". Did you mean the other side?`);
      });
    }
    if (phase.decisionPoint) checkSide(where, phase.decisionPoint.side);
    if (phase.needsVerification) {
      needsVerification.push({ where, message: "phase positions or times not yet checked against the source" });
      if (strict) addError(where, "is marked needsVerification.");
    }
    (phase.estimatedPositions || []).forEach((unitId) => {
      checkUnit(where, unitId);
      needsVerification.push({ where, message: `position of "${unitId}" is estimated, not read from a source map` });
    });
  });

  const patrolOrders = file("patrolOrder.json");
  (Array.isArray(patrolOrders) ? patrolOrders : []).forEach((order, index) => {
    const where = `${base}/patrolOrder.json [${index}]`;
    if (order.battleId !== battleFolder) addError(where, `battleId "${order.battleId}" should be "${battleFolder}".`);
    checkSide(where, order.side);
  });

  const plans = file("plans.json");
  (Array.isArray(plans) ? plans : []).forEach((plan, index) => {
    const where = `${base}/plans.json [${index}] (plan "${plan.id}")`;
    checkSide(where, plan.side);
    Object.keys(plan.positions || {}).forEach((unitId) => checkUnit(where, unitId));
    (plan.arrows || []).forEach((arrow) => { if (arrow.unitId) checkUnit(where, arrow.unitId); });
  });

  const whatIfs = file("whatifs.json");
  (Array.isArray(whatIfs) ? whatIfs : []).forEach((whatIf, index) => {
    const where = `${base}/whatifs.json [${index}] (what-if "${whatIf.id}")`;
    const forkedPhase = phases[whatIf.forkPhase];
    if (!forkedPhase) addError(where, `forkPhase ${whatIf.forkPhase} doesn't exist (there are ${phases.length} phases).`);
    else if (!forkedPhase.decisionPoint) addError(where, `forks at phase ${whatIf.forkPhase} ("${forkedPhase.title}"), which has no decisionPoint. What-ifs branch only at documented decisions.`);
    const alternatePhases = [...(whatIf.phases || []), ...(whatIf.endings || []).flatMap((ending) => ending.phases || [])];
    const textsToScan = [whatIf.change, ...(whatIf.reasoning || []), ...alternatePhases.map((alternate) => alternate.narration)];
    textsToScan.filter(Boolean).forEach((text) => {
      if (CASUALTY_FIGURE_PATTERN.test(text)) addWarning(where, `looks like it states a casualty figure ("${truncate(text, 60)}"). What-ifs stay at "held the line" level; never invent numbers.`);
    });
    alternatePhases.forEach((alternate) => Object.keys(alternate.units || {}).forEach((unitId) => checkUnit(where, unitId)));
  });
}

// ---------- Small helpers ----------

// Calls visit(key, value, path) for every key in nested objects and arrays.
function walkValues(value, visit, valuePath = "") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkValues(item, visit, `${valuePath}[${index}]`));
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      const childPath = valuePath ? `${valuePath}.${key}` : key;
      visit(key, child, childPath);
      walkValues(child, visit, childPath);
    }
  }
}

// For list files, name the record by its id so errors are easy to find: "content/facts/x.json [2] (id "foo")".
function describeLocation(where, data, valuePath = "") {
  const match = /^\[(\d+)\]/.exec(valuePath);
  if (Array.isArray(data) && match) {
    const record = data[Number(match[1])];
    if (record && typeof record.id === "string") return `${where} [${match[1]}] (id "${record.id}")`;
    return `${where} [${match[1]}]`;
  }
  return where;
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function truncate(text, length) {
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

function localDateString() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ---------- Command line ----------

function printReport({ errors, warnings, needsVerification, stats }, contentDirectory) {
  const shownPath = path.relative(process.cwd(), contentDirectory).split(path.sep).join("/") || ".";
  console.log(`Checking ${shownPath}: ${stats.files} files, ${stats.facts} facts, ${stats.sources} sources, ${stats.modules} modules, ${stats.sequences} sequences, ${stats.games} games, ${stats.images} images, ${stats.battles} battles.`);
  const printGroup = (heading, items, marker) => {
    if (items.length === 0) return;
    console.log(`\n${heading} (${items.length})`);
    items.forEach(({ where, message }) => console.log(`  ${marker} ${where}\n      ${message}`));
  };
  printGroup("ERRORS", errors, "ERROR");
  printGroup("Warnings", warnings, "warn ");
  printGroup("Needs verification", needsVerification, "check");
  console.log(errors.length ? `\nFAILED: ${errors.length} error(s). Fix them and run \`npm run check\` again.` : "\nPASSED.");
}

const isMainScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainScript) {
  const argumentsList = process.argv.slice(2);
  const strict = argumentsList.includes("--strict");
  const contentFlagIndex = argumentsList.indexOf("--content");
  const contentDirectory = contentFlagIndex >= 0 ? path.resolve(argumentsList[contentFlagIndex + 1]) : DEFAULT_CONTENT_DIRECTORY;
  const result = runCheck({ contentDirectory, strict });
  printReport(result, contentDirectory);
  process.exitCode = result.errors.length ? 1 : 0;
}
