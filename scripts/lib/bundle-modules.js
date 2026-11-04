// Joins the site's ES modules into one script for the offline single-file build.
// No dependencies, and deliberately simple: it understands exactly the import and
// export forms this project uses, and stops with a clear message on anything else.
//
// Supported:
//   import { name, other as alias } from "./relative/file.js";
//   export function name() {}      export async function name() {}
//   export const name = …;         export let name = …;         export class Name {}
// Not supported (the build fails and says so): default exports, export lists,
// "import * as", bare package imports, dynamic import().
//
// How it works: each file becomes a function that runs once and returns its exports.
// Files are placed so that every file comes after the files it imports.

import { readFileSync } from "node:fs";
import path from "node:path";

const IMPORT_PATTERN = /^\s*import\s+\{([^}]*)\}\s+from\s+"([^"]+)";\s*$/gm;
const EXPORT_PATTERN = /^export\s+(async\s+function|function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm;
const UNSUPPORTED = [
  [/^\s*export\s+default\b/m, "export default"],
  [/^\s*export\s*\{/m, "export { … } lists"],
  [/^\s*import\s+\*\s+as\b/m, "import * as"],
  [/^\s*import\s+[A-Za-z_$][\w$]*\s+from\b/m, "default imports"],
  [/\bimport\s*\(/, "dynamic import()"],
  [/^\s*import\s+"[^"]+";/m, "side-effect imports"]
];

export function bundleModules(entryFile, repoRoot) {
  const ordered = []; // files in dependency order
  const visiting = new Set();
  const done = new Set();

  function visit(file) {
    if (done.has(file)) return;
    if (visiting.has(file)) throw new Error(`Import loop involving ${relative(file)}. Break the loop so the offline build can order the files.`);
    visiting.add(file);
    const code = readFileSync(file, "utf8");
    for (const [pattern, name] of UNSUPPORTED) {
      if (pattern.test(code)) throw new Error(`${relative(file)} uses ${name}, which scripts/lib/bundle-modules.js doesn't support. Use named imports and "export function/const".`);
    }
    for (const match of code.matchAll(IMPORT_PATTERN)) {
      if (!match[2].startsWith(".")) throw new Error(`${relative(file)} imports "${match[2]}". Only relative imports (./ or ../) can be bundled.`);
      visit(path.resolve(path.dirname(file), match[2]));
    }
    visiting.delete(file);
    done.add(file);
    ordered.push(file);
  }

  const relative = (file) => path.relative(repoRoot, file).split(path.sep).join("/");
  const variableFor = (file) => `module_${relative(file).replace(/[^A-Za-z0-9]/g, "_")}`;

  visit(path.resolve(entryFile));

  const parts = ordered.map((file) => {
    let code = readFileSync(file, "utf8");
    const exportedNames = [...code.matchAll(EXPORT_PATTERN)].map((match) => match[2]);
    code = code.replace(IMPORT_PATTERN, (whole, names, specifier) => {
      const target = path.resolve(path.dirname(file), specifier);
      const bindings = names.split(",").map((name) => name.trim()).filter(Boolean)
        .map((name) => name.replace(/\s+as\s+/, ": "));
      return `const { ${bindings.join(", ")} } = ${variableFor(target)};`;
    });
    code = code.replace(EXPORT_PATTERN, (whole, kind, name) => `${kind} ${name}`);
    const exportsObject = exportedNames.length ? `return { ${exportedNames.join(", ")} };` : "return {};";
    return `// ----- ${relative(file)} -----\nconst ${variableFor(file)} = (() => {\n${code}\n${exportsObject}\n})();`;
  });

  return { code: parts.join("\n\n"), files: ordered.map(relative) };
}
