#!/usr/bin/env node
// Builds dist/military-heritage.html: one file that runs with Wi-Fi off.
// Run with `npm run build` (that also refreshes the content index and runs the source check first).
//
// What it does:
//   - inlines src/styles.css into a <style> tag
//   - embeds every content file as JSON in <script type="application/json" id="embedded-content">
//   - joins src/app.js and everything it imports into one script (scripts/lib/bundle-modules.js)
//
// Phase 7 adds re-hostable images from assets/images and an offline test.
// The display window in the offline file is opened from the same file (#/display) and is
// linked by postMessage, since BroadcastChannel is unreliable on file:// pages.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONTENT_INDEX_FILE, DEFAULT_CONTENT_DIRECTORY, REPO_ROOT, listContentFiles } from "./lib/content-files.js";
import { bundleModules } from "./lib/bundle-modules.js";

const STYLESHEET_TAG = '<link rel="stylesheet" href="src/styles.css">';
const APP_SCRIPT_TAG = '<script type="module" src="src/app.js"></script>';
const outputPath = path.join(REPO_ROOT, "dist", "military-heritage.html");

const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

// Text placed inside a <script> or <style> must never contain "</script" or "</style",
// or the browser would end the tag early. "<\/" means the same thing to JavaScript and JSON.
const makeSafeForInlineTag = (text) => text.replace(/<\/(script|style)/gi, "<\\/$1");

export function buildSingleFile() {
  let page = read("index.html");
  const styles = read("src/styles.css");
  const { code: appCode, files: bundledFiles } = bundleModules(path.join(REPO_ROOT, "src", "app.js"), REPO_ROOT);

  for (const tag of [STYLESHEET_TAG, APP_SCRIPT_TAG]) {
    if (!page.includes(tag)) throw new Error(`index.html no longer contains ${tag}; update build-single-file.js to match.`);
  }

  // Bundle all content, keyed by its path inside /content, plus the index the app reads first.
  const contentFiles = listContentFiles(DEFAULT_CONTENT_DIRECTORY);
  const embeddedContent = { [CONTENT_INDEX_FILE]: { files: contentFiles } };
  for (const relativePath of contentFiles) {
    embeddedContent[relativePath] = JSON.parse(readFileSync(path.join(DEFAULT_CONTENT_DIRECTORY, relativePath), "utf8"));
  }

  page = page.replace(STYLESHEET_TAG, () => `<style>\n${makeSafeForInlineTag(styles)}\n</style>`);
  page = page.replace(APP_SCRIPT_TAG, () => [
    `<script type="application/json" id="embedded-content">${makeSafeForInlineTag(JSON.stringify(embeddedContent))}</script>`,
    `<script type="module">\n${makeSafeForInlineTag(appCode)}\n</script>`
  ].join("\n  "));

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, page, "utf8");
  return { outputPath, sizeInKilobytes: Buffer.byteLength(page, "utf8") / 1024, contentFileCount: contentFiles.length, bundledFiles };
}

const isMainScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMainScript) {
  try {
    const result = buildSingleFile();
    console.log(`Built dist/military-heritage.html (${result.sizeInKilobytes.toFixed(1)} KB, ${result.contentFileCount} content files, ${result.bundledFiles.length} code files).`);
  } catch (error) {
    console.error(`Build failed: ${error.message}`);
    process.exitCode = 1;
  }
}
