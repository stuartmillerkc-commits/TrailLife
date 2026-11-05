// A small JSON Schema validator with no dependencies.
//
// Why not a library? The project rule is "nothing to install". This file
// supports only the parts of JSON Schema (draft 2020-12) that the files in
// /schemas actually use:
//
//   type, enum, const, required, properties, additionalProperties,
//   items, minItems, maxItems, uniqueItems, minLength, pattern,
//   minimum, maximum, format ("date", "uri"), $ref, allOf, anyOf, oneOf,
//   if / then
//
// If you add a schema keyword that isn't in this list, add support here too,
// or the validator will silently ignore it. `unsupportedKeywords` below catches
// the common ones and throws, so you'll find out.

import { readFileSync } from "node:fs";
import path from "node:path";

const IGNORED_KEYWORDS = new Set([
  "$schema", "$id", "$defs", "$comment", "title", "description", "examples", "default", "markdownDescription"
]);
const SUPPORTED_KEYWORDS = new Set([
  "type", "enum", "const", "required", "properties", "additionalProperties", "items",
  "minItems", "maxItems", "uniqueItems", "minLength", "pattern", "minimum", "maximum",
  "format", "$ref", "allOf", "anyOf", "oneOf", "if", "then"
]);

export class SchemaLibrary {
  constructor(schemaDirectory) {
    this.schemaDirectory = schemaDirectory;
    this.loadedSchemas = new Map(); // file name -> parsed schema
  }

  load(fileName) {
    if (!this.loadedSchemas.has(fileName)) {
      const fullPath = path.join(this.schemaDirectory, fileName);
      this.loadedSchemas.set(fileName, JSON.parse(readFileSync(fullPath, "utf8")));
    }
    return this.loadedSchemas.get(fileName);
  }

  // Validate `value` against the schema file `fileName`.
  // Returns a list of { path, message } problems; empty means valid.
  validate(value, fileName) {
    const problems = [];
    this.#check(value, this.load(fileName), fileName, "", problems);
    return problems;
  }

  // Follow a $ref such as "#/$defs/id" or "common.schema.json#/$defs/id".
  #resolveReference(reference, currentFile) {
    const [filePart, pointer = ""] = reference.split("#");
    const targetFile = filePart || currentFile;
    let node = this.load(targetFile);
    for (const segment of pointer.split("/").filter(Boolean)) {
      node = node?.[segment];
      if (node === undefined) throw new Error(`Schema reference not found: ${reference} (from ${currentFile})`);
    }
    return { schema: node, file: targetFile };
  }

  #check(value, schema, currentFile, valuePath, problems) {
    if (schema === true) return;
    if (schema === false) { problems.push({ path: valuePath, message: "is not allowed here" }); return; }

    for (const keyword of Object.keys(schema)) {
      if (!SUPPORTED_KEYWORDS.has(keyword) && !IGNORED_KEYWORDS.has(keyword)) {
        throw new Error(`Schema keyword "${keyword}" in ${currentFile} isn't supported by json-schema-lite.js`);
      }
    }

    const add = (message) => problems.push({ path: valuePath, message });

    if (schema.$ref) {
      const { schema: target, file } = this.#resolveReference(schema.$ref, currentFile);
      this.#check(value, target, file, valuePath, problems);
    }

    if (schema.type !== undefined) {
      const allowedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
      if (!allowedTypes.some((typeName) => matchesType(value, typeName))) {
        add(`should be ${allowedTypes.join(" or ")}, but is ${describeType(value)}`);
        return; // Further checks would only produce confusing follow-on errors.
      }
    }

    if (schema.const !== undefined && !deepEqual(value, schema.const)) add(`should be ${JSON.stringify(schema.const)}`);
    if (schema.enum && !schema.enum.some((option) => deepEqual(option, value))) {
      add(`should be one of: ${schema.enum.map((option) => JSON.stringify(option)).join(", ")}`);
    }

    if (typeof value === "string") {
      if (schema.minLength !== undefined && value.length < schema.minLength) add(schema.minLength === 1 ? "should not be empty" : `should be at least ${schema.minLength} characters`);
      if (schema.pattern && !new RegExp(schema.pattern, "u").test(value)) add(`"${value}" doesn't match the expected pattern ${schema.pattern}`);
      if (schema.format === "date" && !isRealDate(value)) add(`"${value}" should be a real date written YYYY-MM-DD`);
      if (schema.format === "uri" && !/^https?:\/\/[^\s]+\.[^\s]+/.test(value)) add(`"${value}" should be a full web address starting with http:// or https://`);
    }

    if (typeof value === "number") {
      if (schema.minimum !== undefined && value < schema.minimum) add(`should be at least ${schema.minimum}`);
      if (schema.maximum !== undefined && value > schema.maximum) add(`should be at most ${schema.maximum}`);
    }

    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) add(`should have at least ${schema.minItems} item(s)`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) add(`should have at most ${schema.maxItems} item(s)`);
      if (schema.uniqueItems) {
        const seen = new Set();
        value.forEach((item) => {
          const key = JSON.stringify(item);
          if (seen.has(key)) add(`has a duplicate entry ${key}`);
          seen.add(key);
        });
      }
      if (schema.items) value.forEach((item, index) => this.#check(item, schema.items, currentFile, `${valuePath}[${index}]`, problems));
    }

    if (isPlainObject(value)) {
      for (const requiredKey of schema.required || []) {
        if (!(requiredKey in value)) add(`is missing required field "${requiredKey}"`);
      }
      const knownProperties = schema.properties || {};
      for (const [key, childValue] of Object.entries(value)) {
        const childPath = valuePath ? `${valuePath}.${key}` : key;
        if (key in knownProperties) {
          this.#check(childValue, knownProperties[key], currentFile, childPath, problems);
        } else if (schema.additionalProperties === false) {
          problems.push({ path: childPath, message: `isn't a recognized field (check the spelling)` });
        } else if (isPlainObject(schema.additionalProperties)) {
          this.#check(childValue, schema.additionalProperties, currentFile, childPath, problems);
        }
      }
    }

    for (const subSchema of schema.allOf || []) this.#check(value, subSchema, currentFile, valuePath, problems);

    if (schema.anyOf && !schema.anyOf.some((subSchema) => this.#passes(value, subSchema, currentFile))) {
      add(describeAlternatives(schema.anyOf, "should match at least one of"));
    }
    if (schema.oneOf) {
      const matchCount = schema.oneOf.filter((subSchema) => this.#passes(value, subSchema, currentFile)).length;
      if (matchCount !== 1) add(describeAlternatives(schema.oneOf, matchCount === 0 ? "should match one of" : "matches more than one of"));
    }

    if (schema.if && schema.then && this.#passes(value, schema.if, currentFile)) {
      this.#check(value, schema.then, currentFile, valuePath, problems);
    }
  }

  #passes(value, schema, currentFile) {
    const problems = [];
    this.#check(value, schema, currentFile, "", problems);
    return problems.length === 0;
  }
}

function describeAlternatives(alternatives, prefix) {
  const names = alternatives.map((subSchema) => subSchema.title || subSchema.description || subSchema.$ref || "an option");
  return `${prefix}: ${names.join(" | ")}`;
}

function matchesType(value, typeName) {
  switch (typeName) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "object": return isPlainObject(value);
    case "null": return value === null;
    default: throw new Error(`Unknown schema type "${typeName}"`);
  }
}

function describeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "a list";
  if (typeof value === "object") return "an object";
  return `${typeof value} ${JSON.stringify(value)}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// "2026-02-30" matches the pattern but isn't a real date; this catches that.
export function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function deepEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
