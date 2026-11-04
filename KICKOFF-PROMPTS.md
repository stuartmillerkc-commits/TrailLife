# Claude Code prompts, phase by phase

Paste one prompt per cloud session. Wait for the phase summary, review the pull request, merge, then start the next session.

## Phase 0 — Scaffold
> Read CLAUDE.md and PLAN.md fully. Do Phase 0 only: create the folder layout from PLAN.md section 4, the JSON schemas from section 6 (module, fact, sequence, image, game) and section 8.7 (battle, units, phases, patrol order), `scripts/check-sources.js`, and a README explaining how to run the site locally, edit content, and build the offline file. Include one sample module and one sample fact so the check script has something to pass and fail on. Stop and summarize.

## Phase 1 — Navigator and presenter
> Do Phase 1 from PLAN.md. Convert `content-source/leader-guide.md` into module JSON files and two sequences (Meeting 1, Meeting 2). Every fact used goes into a fact record with its source from the guide's Sources section. Build the module pages, the sequence player with timer and short-on-time toggle, and two-window mode (leader view drives display view over BroadcastChannel; display never shows answers early). Keyboard shortcuts per section 5. Stop and list any fact you couldn't source.

## Phase 2 — Sequence builder and tracker
> Do Phase 2 from PLAN.md: library filters, drag-to-build sequences with a running time total, save/export/import JSON, share link, the requirement coverage strip that warns when no Military Experience item (6 or 7) is planned, and the local-only requirement tracker with CSV export. Stop and summarize.

## Phase 3 — Games
> Do Phase 3 from PLAN.md. Build Jeopardy, Which Branch?, Rank Ladder, Who Outranks Whom?, Branch Timeline, and Holiday Calendar. Use `content-source/chat-reference.md` for content; anything marked "verify" must be checked and given a fact record, or flagged with needsVerification. Every Jeopardy clue links to a fact. Patrol scoring persists through a page refresh. Stop and list unverified items.

## Phase 4a — Battle engine and Cowpens
> Do Phase 4a. `prototype/cowpens-prototype.html` is the reference implementation. Port its battle data into `content/battles/cowpens/` JSON and its logic into `src/battle/` modules, keeping every UX pattern listed in CLAUDE.md. Then check each phase's positions and times against `sources/cowpens-staff-ride.pdf` maps 8–14 and correct anything the prototype got wrong; list every correction. Stop and summarize.

## Phase 4b — Pegasus Bridge
> Do Phase 4b. Add Pegasus Bridge using data files only; if the engine needs a change, explain why before making it. Use the facts and sources in PLAN.md section 8.4. Model it at platoon level (six glider loads, two bridges). Include the decision points and the bridge exercise from section 8.8. Mark anything you can't source as needsVerification. Stop and summarize.

## Phase 4c — Westport
> Do Phase 4c. Add the Battle of Westport from `sources/prices-expedition-atlas.pdf` (Combat Studies Institute, 2016), using the facts and seven phases in PLAN.md section 8.4. Include the strategic layer of Price's Raid, the Brush Creek and Byram's Ford fronts, and the George Thoman decision point. Cross-check units against the Wikipedia order-of-battle pages linked in the plan. List every position you had to estimate.

## Phase 4d — Capture the flag planner
> Do Phase 4d from PLAN.md section 8.8: field canvas with grid, OAKOC prompts, the marker palette using the same symbols as the battles, the patrol-order template with Morgan's and Howard's plans shown beside it, plan lock, printable plan card, and the after-action compare between rounds. Stop and summarize.

## Phase 4e — Game mode
> Do Phase 4e from PLAN.md section 8.11: Command and Sandbox modes, drag units with mouse and touch, draw planned and actual arrows, place symbols, layers per patrol with hidden plans until both lock, undo and redo, save and load scenario JSON, and PNG export. No combat math; the leader umpires. Test with Cowpens. Stop and summarize.

## Phase 4f — Terrain pipeline
> Do Phase 4f from PLAN.md section 8.12. Write a build script that downloads USGS 3DEP elevation for each battle's bounding box once, computes contours and a hillshade image, and bakes them into the battle map so terrain works offline. Add elevation tint with vertical exaggeration, a line-of-sight tool from any unit, and an elevation profile tool. Add the USGS Topo tile layer for the online real-world view. Record the data source and download date in the battle's sources. Network access is needed for the one-time download; if it's blocked, write the script and tell me what to run. Stop and summarize.

## Phase 4g — Replay, intended plans, and what-ifs
> Do Phase 4g from PLAN.md section 8.13. Add smooth replay with a scrubber, trails, and speed control; intended-plan layers from `plans.json` shown only where sources document the plan; a plan-vs-reality view; and what-if branches from `whatifs.json` with the "What-if: not history" banner, distinct marker style, confidence label, and sourced reasoning bullets. Build Morgan's and Tarleton's plans and the "What if Tarleton waited?" what-if for Cowpens first. Never invent casualty numbers in a what-if. Stop and list each what-if's reasoning sources.

## Phase 5 — Printables
> Do Phase 5. Generate DOCX card decks (branch timeline, academy, holiday, rank insignia, scenario cards), battle unit markers, phase cards for each battle, and contour templates tiled on letter paper. Test that cut lines align when printed at 100%. Stop and summarize.

## Phase 6 — Picture ID
> Do Phase 6. Build the image manifest from PLAN.md section 10 with license metadata per image. Only re-host public-domain or openly licensed images; everything else is a link. No graphic combat photos. Stop and list each image's source and license.

## Phase 7 — Offline build
> Do Phase 7. Make `scripts/build-single-file.js` produce `dist/military-heritage.html` with all code, data, and re-hostable images inlined. Verify it runs Meeting 1 and all three battles with networking disabled. Stop and report file size.

## Useful follow-ups any time
- Review: "Review this phase against CLAUDE.md's accuracy rules. List every fact without a source and every place a source disagreement isn't recorded."
- Fix from testing: "At the troop meeting, [what went wrong]. Fix it and add a note to the README's known-issues list."
- Teach-back: "Explain how a non-developer adds a new battle using only data files. Put the answer in docs/adding-a-battle.md."
