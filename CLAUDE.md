# Military Heritage lesson site — standing instructions

A browser-based lesson tool for Trail Life USA Troop MO-8605 leaders teaching the Military Heritage Trail Badge to Navigators and Adventurers (ages 11–17). Read `PLAN.md` before any task. It is the source of truth for scope, data model, and build phases.

## How to work
- Read `docs/decisions.md` after `PLAN.md`. It records where the build deliberately differs from the plan (positions as coordinates, `hiddenFrom` fog of war, the source registry, phase order). Where they disagree, `docs/decisions.md` wins. Add to it when a phase makes a similar call.
- Run `npm test` and `npm run check` before every commit. Both must pass.
- Work one phase from `PLAN.md` section 11 at a time. At the end of a phase, stop, summarize what was built, list anything unverified, and wait for review before starting the next.
- Small commits with clear messages. One pull request per phase.
- If an instruction here conflicts with a request in the session, ask.

## Code rules
- Vanilla JavaScript with ES modules. No framework, no TypeScript, no bundler beyond the single-file build script.
- Readable, descriptive variable and function names. No minification. Comment anything non-obvious. The next maintainer is a volunteer, not a developer.
- Content lives in `/content` as JSON. Code never hard-codes lesson content.
- The offline build (`scripts/build-single-file.js`) must produce one HTML file that runs with Wi-Fi off.
- Support light and dark mode, keyboard navigation, visible focus, and reduced motion.
- Reader-facing text uses typographic quotes and apostrophes (’ “ ”); code uses straight quotes.

## Accuracy rules (non-negotiable)
- Every historical fact in content carries a source URL and a `verifiedOn` date. `scripts/check-sources.js` fails the build otherwise.
- Never invent unit positions, times, or figures. Battle positions come from the public-domain Army staff ride guides in `/sources` (Cowpens, Wilson's Creek) or the cited sources for Pegasus Bridge.
- When sources disagree, record both and say which one the site displays. Don't silently pick one.
- If you can't verify a fact from `/sources` or the web, mark it `"needsVerification": true` and list it in your phase summary. Don't guess.
- Never trace or copy copyrighted maps (for example, American Battlefield Trust maps). Link to them only.
- Paraphrase Trail Life USA badge requirements; the badge text is copyrighted. Point to Trail Life Connect for official wording.
- Animated battle positions are labeled "approximate" with the source on every phase.

## Content tone
- Written for boys 11–17: plain words, short sentences, decisions rather than gore. No graphic descriptions of wounds or death.
- Neutral on current politics. The Posse Comitatus and Selective Service material stays on history and principle.
- Leader notes (scripts, answers, discussion questions) are hidden from the projector view.

## Privacy
- No boys' names or personal data leave the browser. Tracking uses localStorage plus export to a file.

## Reference implementation
- `prototype/cowpens-prototype.html` is a working single-file prototype of the battle module. Port its data into JSON and its logic into `src/battle/` modules. Keep its patterns: region/terrain/tactical map toggle, grid matching the sand table, decision points with reveal, Tarleton's-view fog of war, auto-generated sand table moves, and the "as a patrol order" panel.

## Source material in this repo
- `content-source/leader-guide.md` — the two-meeting leader guide (Meetings 1 and 2, fact sheet). Primary content for Phase 1.
- `content-source/chat-reference.md` — branch roles, scenarios, special operations, ranks, holidays. Items marked "verify" were not web-checked.
- `sources/` — public-domain PDFs (staff ride guides). See `sources/README.md`.

## Printables
- Cut-apart cards, unit markers, and phase cards are generated as DOCX (prints cut lines more reliably than HTML). PDF is acceptable for phase cards.
