# Military Heritage Trail Badge: lesson site

A browser-based lesson tool for Trail Life USA Troop MO-8605. Leaders use it to teach the Military Heritage Trail Badge to Navigators and Adventurers. It's a plain website: no accounts, no server, and nothing about the boys ever leaves the leader's browser.

**Status:** Phase 0 (scaffold). The data formats, source check and build tools are in place. The lesson pages, presenter, games and battles arrive in later phases; see `PLAN.md` section 11.

Badge requirements are paraphrased here. See Trail Life Connect for the official wording.

---

## What you need

- **Node.js 20 or newer.** Download the LTS version from [nodejs.org](https://nodejs.org/) and install it with the default options. To check, open a terminal (PowerShell on Windows, Terminal on Mac) and run `node --version`.
- Nothing else. The project has no packages to install, so there's no `npm install` step.
- Optional: [VS Code](https://code.visualstudio.com/). It flags content mistakes as you type (see [Editing content](#editing-content)).

All commands below run from this folder in a terminal.

## Run the site on your computer

```
npm start
```

Then open **http://localhost:8000** in your browser. Press **Ctrl+C** in the terminal to stop.

- It works with Wi-Fi off.
- After editing a file, refresh the browser to see the change.
- Port 8000 already busy? Pick another. PowerShell: `$env:PORT=9000; npm start`. Mac: `PORT=9000 npm start`.
- **Don't double-click `index.html`.** Browsers block the site's scripts on pages opened straight from disk. Use `npm start`, or use the offline file below.

## Build the offline file

```
npm run build
```

This makes **`dist/military-heritage.html`**: one file holding the whole site and its content. Copy it to a laptop or USB stick, or email it, then double-click to open. No Wi-Fi or server is needed.

The build checks content first and stops if the check fails. Before a real meeting, also run `npm run check:strict` (see below) so nothing unverified ends up on the projector.

At this phase the offline file shows only the scaffold page. Phase 7 finishes it: images, all battles, and a test with networking turned off.

## Editing content

All lesson content lives in **`/content`** as JSON files. Code never contains lesson text, so changing what the boys see means editing these files.

| Folder | What's in it | One file holds |
| --- | --- | --- |
| `content/modules/` | Lesson blocks (an opener, a race, a discussion) | One module. The file name matches its `id`. |
| `content/sequences/` | Meetings: modules in order, with minutes | One meeting |
| `content/facts/` | Every historical fact, with its source | A list of facts on one topic |
| `content/sources/sources.json` | Documents cited by id (staff ride guides, atlases) | The whole list |
| `content/games/` | Jeopardy boards and other games (Phase 3) | One game |
| `content/images/manifest.json` | Every image, with credit and license (Phase 6) | The whole list |
| `content/battles/<battle>/` | `battle.json`, `units.json`, `phases.json`, and optionally `strategic.json`, `patrolOrder.json`, `plans.json` and `whatifs.json` | One battle per folder |

The exact format of each file is in **`/schemas`**. Each schema has a description for every field. `docs/decisions.md` explains where the formats differ from `PLAN.md`.

### The accuracy rule

Every historical fact the site shows lives in `content/facts/`, with a source and the date someone checked it:

```json
{
  "id": "branch-space-force",
  "statement": "The Space Force, one of the six U.S. armed forces, was established on December 20, 2019, …",
  "source": { "title": "United States Space Force", "url": "https://en.wikipedia.org/wiki/United_States_Space_Force" },
  "verifiedOn": "2026-11-04",
  "disagreement": null
}
```

- Modules, games and battles **point to** facts by id (`"factIds": ["branch-space-force"]`). They never restate a fact without pointing to it.
- **Can't confirm something?** Don't guess. Add `"needsVerification": true` and leave out the source. The check lists it as needing work.
- **Sources disagree?** Keep the version the site shows as the `statement`. List the others under `disagreement.alternatives`, each with its own source, and say which one the site displays in `disagreement.siteDisplays`.
- Reader-facing text uses curly quotes and apostrophes (’ “ ”). The check warns when it finds straight ones.
- Never copy or trace copyrighted maps, such as the American Battlefield Trust's. Link to them instead.

### Check your changes

```
npm run check
```

This reads every content file and reports problems by file and record. For example:

```
ERROR content/facts/branches.json [0] (fact "branch-army-founded")
    has no source. Add "source": { "title": …, "url": … } or a "sourceId" …
```

- **ERROR** must be fixed; the build won't run until it is.
- **warn** is worth a look but doesn't block anything.
- **check** means a fact or position is marked as unverified.
- **`npm run check:strict`** treats the **check** items as errors. Use it before building the file for a meeting.
- **`npm run check:failing`** runs the check on a deliberately broken sample, so you can see what a failure looks like.

The check catches:
- broken JSON (usually a missing comma or quote)
- fields that are missing or misspelled
- facts without a source or a `verifiedOn` date
- links to facts, sources, modules or units that don't exist
- battle phases that don't cite a source
- what-ifs without a confidence label or sourced reasoning

### Added or renamed a file?

Run `npm run index`. It rebuilds `content/index.json`, the list of files the site loads. `npm start` and `npm run build` do this for you, and `npm run check` tells you when it's out of date.

### Editing in VS Code

Open this folder in VS Code (File › Open Folder). It reads `.vscode/settings.json` and checks every content file against its schema as you type. Mistakes get a red underline, and hovering over a field shows what it's for.

## Tests

```
npm test
```

These tests check the source check itself. They feed it deliberately broken content (an unsourced fact, a phase with no source, a what-if with no confidence label, and so on) and confirm it catches each problem. Run them after changing anything in `/scripts` or `/schemas`. The test content lives in `tests/fixtures/`.

## Folder map

```
index.html            the site's page
src/                  the site's code (app.js, styles.css; battle/, games/ and print/ arrive in later phases)
content/              all lesson content (see above)
schemas/              the format of each content file, plus schema-map.json (which schema checks which file)
scripts/
  check-sources.js        npm run check
  build-content-index.js  npm run index
  build-single-file.js    npm run build
  serve.js                npm start
  lib/                    shared helpers, including a small schema checker
assets/images/        images licensed for re-hosting (Phase 6)
sources/              public-domain source PDFs; see sources/README.md
content-source/       raw material being turned into content: leader-guide.md, chat-reference.md
prototype/            the Cowpens prototype, the reference for Phase 4a
printables/           DOCX card decks and sand table kit
docs/                 decisions.md, the dry-run checklist, video links
tests/                npm test and its fixtures
PLAN.md               the full build plan
CLAUDE.md             standing instructions for Claude Code sessions
KICKOFF-PROMPTS.md    the prompt for each build phase
```

## Known issues

- `sources/prices-expedition-atlas.pdf` and `sources/wilsons-creek-staff-ride.pdf` aren't in the repo yet; the hosting sites block scripted downloads. Download them in a browser using the links in `sources/README.md`. Until then, `npm run check` prints two warnings.
- The project folder is inside OneDrive. OneDrive syncing can occasionally damage a `.git` folder. If git starts reporting odd errors, pause OneDrive sync, or move the repo out of OneDrive.
