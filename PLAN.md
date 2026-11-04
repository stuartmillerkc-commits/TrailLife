# Military Heritage Trail Badge — Interactive Lesson Site
### Build plan for Claude Code

**Troop:** Trail Life USA MO-8605, Independence, MO
**Audience:** Trail Guides leading Navigators and Adventurers (ages 11–17), ~8 boys per session
**Status:** Plan, plus a working Cowpens prototype in `prototype/cowpens-prototype.html` (the reference implementation for Phase 4a).
**Content source:** [Military Heritage Two-Meeting Leader Guide](https://claude.ai/artifact/JCK5tfFMrKBBU3BvurFGWo) plus the follow-up Q&A content captured in section 9.

---

## 1. What this is

A browser-based lesson tool that lets a Trail Guide run the Military Heritage Trail Badge without prep-reading a binder. It has four jobs:

1. **Lead a lesson.** Step through a meeting in order, with leader notes on one screen and boy-facing content on the projector.
2. **Build a lesson.** Pick modules, reorder them, save the sequence, hand it to another leader.
3. **Play.** Jeopardy, picture ID, and drag-and-sort games run on the projector with patrol scoring.
4. **Study battles, then plan their own.** Three interactive battles (Cowpens, Pegasus Bridge, and the local Battle of Westport) shown in political, topographic, and tactical map layers, mirrored on a sand table with printed unit markers. It ends in a capture the flag planner that uses the same symbols and order format.

The site supports a lesson; it doesn't replace the hands-on parts. Capture the flag, the Tomb Guard walk, and the floor calendar stay physical. The screen gives the leader the script, the answer key, and the scoreboard.

---

## 2. Constraints and honest tradeoffs (read first)

**The battle study doesn't complete a battle requirement on its own.** Requirements 12, 13, 14, 19 and 24 all require a visit or a reenactment. The table study is the preparation that makes a visit meaningful. Westport, the local battle, is the visit. It fits Requirement 14 (a Civil War trail trip) and 15 (museum) more cleanly than 12, which strictly requires an NPS National Battlefield. See section 8.10.

**Badge text is copyrighted.** The 2018 badge sheet says no part may be reproduced without TLUSA permission. If the site is public (GitHub Pages), paraphrase requirements in a sentence and point to Trail Life Connect for the official wording. If you want verbatim text, keep the repo private.

**Offline matters more than it seems.** Meeting rooms often have weak Wi-Fi. Anything hotlinked from another site (images, map tiles, CDN libraries) can fail mid-meeting. Plan: vendor libraries, download images that are licensed for reuse, and keep a built single-file version for offline use. Images that can't be re-hosted stay as "open source page" links and degrade to a text card.

**Image licensing varies by source.**
- Most U.S. military photos (DVIDS, branch .mil sites, NPS, Library of Congress) are public domain as government works.
- Wikimedia Commons is mixed; record each file's license.
- American Battlefield Trust maps are copyrighted, so link to them; don't embed or trace them.
- Branch seals and insignia are fine for this educational use but shouldn't be put on merchandise.

**Accuracy is non-negotiable.** Every fact used in a game, card, or script carries a source URL and a verified date in the data (section 6). Sources disagree: Wilson's Creek casualty figures differ between American Battlefield Trust (1,235 Union, 1,095 Confederate) and other references (1,317 / 1,222). The site should show one figure, cite it, and optionally note the disagreement. That's a good teaching moment about how history gets counted.

**Privacy.** The site never stores boys' names on a server. Any per-boy tracking lives in the leader's browser (localStorage) and exports to a file for entry into Trail Life Connect.

**Two-screen sync has limits.** Leader view and projector view can sync between two windows on the same laptop with the BroadcastChannel API. That works when served over http (GitHub Pages or `npx serve`), not reliably from a double-clicked `file://`. Phone-as-remote would need a server, so it's out of scope for v1.

**Kinetic sand quantity.** Kinetic sand is dense (roughly 100 lb per cubic foot). A 2×3 ft area at 1 inch deep is about 50 lb, far more than a typical 5–10 lb kit. Section 8.4 uses foam or cardboard contour layers under a thin sand skin, so the sand only shapes the surface.

---

## 3. Users and modes

| Mode | Who | Screen | What they need |
| --- | --- | --- | --- |
| **Prep** | Leader at home | Laptop | Browse modules, build a sequence, print materials, check the answer key |
| **Lead** | Leader at meeting | Laptop (leader view) | Script, timer, answer key, "next" button, notes on what to skip if short on time |
| **Display** | Boys | Projector or TV (display view) | Big text, images, questions, scoreboard, battle map; no answers until revealed |
| **Table** | Boys | Sand table + printed markers | Grid that matches the screen map, phase cards, unit blocks |

Leader view and display view are the same app in two windows. The leader view drives the display view.

---

## 4. Architecture and tech stack

**Recommendation:** a small static site in a GitHub repo, content stored as data files, with a build step that also produces a single-file HTML for offline use.

| Decision | Choice | Why |
| --- | --- | --- |
| Framework | Vanilla JavaScript with ES modules, no framework | Readable, editable by the next leader, nothing to upgrade. Matches the existing WT meeting planner. |
| Code style | Readable variable names, no minification, comments on non-obvious logic | Future maintainers aren't developers |
| Content | JSON (or YAML compiled to JSON) in `/content` | Leaders can edit content without touching code |
| Maps | SVG schematic battle maps for v1; Leaflet.js real-world view in v2 | SVG matches the sand table and is fast to build; Leaflet adds visit planning later (section 8.3) |
| Hosting | GitHub Pages from the repo | Free, versioned, shareable link |
| Offline | Build script inlines JS, CSS, data and local images into `dist/military-heritage.html` | One file to email or keep on a laptop |
| Printables | Generated as DOCX for cut cards and markers, PDF acceptable for phase cards | DOCX prints cut lines more reliably than HTML |
| State | localStorage for saved sequences, scores, per-boy checklists; export/import as JSON | No server, no accounts |

**Suggested repo layout**

```
military-heritage/
  PLAN.md                 ← this file
  README.md               ← how to run, edit content, build offline file
  index.html
  /src
    app.js                ← router, mode switching, window sync
    navigator.js          ← module browser + sequence player
    sequence-builder.js
    games/
      jeopardy.js
      picture-id.js
      sort-game.js        ← timeline, rank ladder, holiday calendar
      scenario-cards.js   ← "which branch?", Posse Comitatus cards
    battle/
      battle-engine.js    ← phases, unit movement, playback
      battle-map-svg.js
      battle-map-leaflet.js   (v2)
    print/
      build-docx.js       ← markers, card decks, phase cards
    styles.css
  /content
    modules/*.json
    sequences/*.json
    games/*.json
    images/manifest.json
    facts/*.json
    battles/wilsons-creek/
      battle.json
      terrain.json
      units.json
      phases.json
  /assets/images/         ← only images licensed for re-hosting
  /scripts
    build-single-file.js
    check-sources.js      ← fails the build if a fact has no source
```

---

## 5. Site map

```
Home
├── Lead a Meeting
│   ├── Meeting 1 — Who Serves
│   ├── Meeting 2 — Draft, Law & Strategy
│   ├── Battle Study — Cowpens, Pegasus Bridge, Westport (3 meetings + local visit)
│   └── My saved sequences
├── Build a Sequence
├── Module Library (filter by requirement, time, activity type, materials)
├── Games
│   ├── Jeopardy
│   ├── Picture ID
│   ├── Which Branch? (scenario cards)
│   ├── Rank Ladder / Who Outranks Whom?
│   ├── Branch Timeline
│   └── Holiday Calendar
├── Battle Study
│   ├── Cowpens (tactical defense)
│   ├── Pegasus Bridge (tactical offense)
│   ├── Westport (operational, local)
│   ├── Wilson's Creek (optional)
│   ├── Little Round Top, Trenton (v2)
│   └── Capture the Flag Planner
├── Requirement Tracker
├── Printables
└── Leader Reference (fact sheet, sources)
```

**Navigation rules**
- Every module page has: requirement badges, duration, an expand/collapse leader script, "show answer," and "more info" links that open in a new tab.
- Left rail shows the current sequence. Click any step to jump to it; jumping never loses scores or timers.
- Keyboard shortcuts in lead mode: → next, ← back, space starts or pauses the timer, R reveals the answer, B blanks the projector.
- Deep links: every module, game, and battle phase has its own URL hash, so a leader can text another leader a link straight to "Battle phase 4."

---

## 6. Data model

### 6.1 Module

The unit of everything. A meeting is a sequence of modules.

```json
{
  "id": "branch-timeline-race",
  "title": "Branch Timeline Race",
  "requirements": ["1"],
  "durationMinutes": 15,
  "activityType": ["competition", "hands-on"],
  "patrolLevels": ["navigator", "adventurer"],
  "materials": ["24-card branch deck per patrol", "rope"],
  "printables": ["branch-deck"],
  "displayContent": {
    "headline": "Put the branches in order",
    "body": "Build one row per branch: name, founding date, domain, mission.",
    "images": ["army-seal", "navy-seal"]
  },
  "leaderScript": [
    "Hand each patrol a shuffled deck.",
    "One point per correct card. Answer key is in the reveal."
  ],
  "discussionQuestions": [
    {
      "question": "The Army fights on land and the Navy at sea. Why also have Marines?",
      "answer": "Expeditionary sea-to-land force for fast crisis response."
    }
  ],
  "reveal": { "type": "table", "factIds": ["branch-army", "branch-navy"] },
  "moreInfo": [
    { "label": "U.S. Army history", "url": "https://www.army.mil/" }
  ],
  "ifShortOnTime": "Skip the discussion; read the answer key aloud.",
  "lowVolunteerNote": "Runs fine with one leader as a whole-group activity.",
  "linkedGames": ["jeopardy-branches", "branch-timeline-game"]
}
```

### 6.2 Fact (enforces the accuracy rule)

```json
{
  "id": "branch-space-force",
  "statement": "Space Force was established December 20, 2019.",
  "source": { "title": "U.S. Space Force", "url": "https://www.spaceforce.mil/" },
  "verifiedOn": "2026-11-03",
  "disagreement": null
}
```

`scripts/check-sources.js` fails the build if any fact used by a module, game, or battle phase lacks a `source.url` and `verifiedOn`.

### 6.3 Sequence

```json
{
  "id": "meeting-1-who-serves",
  "title": "Meeting 1 — Who Serves",
  "totalMinutes": 75,
  "steps": [
    { "moduleId": "opener-five-or-six", "minutes": 5 },
    { "moduleId": "branch-timeline-race", "minutes": 15 },
    { "moduleId": "academy-run-and-sort", "minutes": 12, "optional": false },
    { "moduleId": "veteran-guest-qa", "minutes": 13, "optional": true }
  ],
  "author": "Stuart",
  "notes": "Run before Veterans Day."
}
```

The builder lets a leader drag modules from the library into steps, mark steps optional, see a running time total, and export the sequence as a JSON file or a share link.

### 6.4 Image

```json
{
  "id": "f35-lightning",
  "caption": "F-35 Lightning II",
  "answer": "F-35 — flown by the Air Force, Navy and Marine Corps",
  "category": "aircraft",
  "localFile": "assets/images/f35.jpg",
  "sourcePage": "https://www.dvidshub.net/...",
  "credit": "U.S. Air Force photo",
  "license": "Public domain (U.S. government work)",
  "rehostAllowed": true
}
```

If `rehostAllowed` is false, the game shows a "view image" link and works only online.

### 6.5 Game

```json
{
  "id": "jeopardy-main",
  "type": "jeopardy",
  "categories": [
    {
      "name": "Branches",
      "clues": [
        { "value": 100, "clue": "The newest branch, created in 2019.", "answer": "What is the Space Force?", "factId": "branch-space-force" }
      ]
    }
  ],
  "finalJeopardy": { "category": "Arlington", "clue": "...", "answer": "...", "factId": "..." }
}
```

### 6.6 Battle

Described in section 8.5.

---

## 7. Feature specs

### 7.1 Lesson Navigator and Presenter

- Module page shows display content full-width; leader script and answers sit in collapsible panels.
- **Two-window mode:** "Open display window" pops a second window. Leader actions (next, reveal, blank, score) broadcast to it. The display window never shows leader notes or unrevealed answers.
- **Timer per step** with a soft warning at 2 minutes left and a running "behind or ahead of schedule" indicator for the whole meeting.
- **"Short on time" toggle** hides optional steps and shows each module's `ifShortOnTime` instruction.
- **Teach-back mode** at the end: draws a random card from the session's covered facts for each boy to explain in 30 seconds.

**Acceptance:** A leader who has never seen the badge can run Meeting 1 from the laptop alone, with the projector showing nothing they wouldn't want boys to see.

### 7.2 Sequence Builder

- Library filters: requirement number, duration, activity type (competition, discussion, hands-on, outdoor), materials needed, indoor or outdoor.
- Drag to add and reorder; running total; warn if over the target meeting length.
- Requirement coverage strip shows which of 1–24 the sequence touches. It also flags if no "Military Experience" item (6 or 7) is planned.
- Save locally, export JSON, import JSON, copy share link.

### 7.3 Games

All games use patrol scoring (2–4 teams, named), a big projector scoreboard, and leader controls on the leader view.

| Game | Mechanic | Requirements | Notes |
| --- | --- | --- | --- |
| **Jeopardy** | 5–6 categories × 5 clues, Daily Double, Final Jeopardy with wagers | 1, 2, 3, 4, 5, 10, 11, 20 | Leader clicks which team answered and right or wrong. No buzzer hardware in v1; optional keyboard buzz (team keys A, L) in v2. |
| **Picture ID** | Image on screen, patrols write the answer; reveal shows answer, credit and a "learn more" link | 1, 20, 21 | Categories in section 10 |
| **Which Branch?** | Scenario on screen, patrols hold up branch cards, reveal with explanation | 1, 4 | 16 scenarios from section 9.3, including debate rounds |
| **Rank Ladder** | Drag insignia into order (Army first; other branches unlockable) | 20 | Includes the gold-below-silver gotcha |
| **Who Outranks Whom?** | Two ranks from different branches; pick the senior | 20 | Navy Captain (O-6) vs. Army Captain (O-3); Air Force Staff Sergeant (E-5) vs. Army Staff Sergeant (E-6) |
| **Branch Timeline** | Drag six branches onto a 1775–2019 line | 1 | Mirrors the physical card race |
| **Holiday Calendar** | Drag holidays onto months, then match purposes | 5 | Mirrors the floor grid |
| **Posse Comitatus Cards** | Green, yellow or red vote per scenario | 4 | Historical scenarios only; leader note on staying neutral |

**Suggested Jeopardy board** (every clue maps to a fact record)

| Branches | Academies | Holidays | Ranks | Draft & Law | Battles |
| --- | --- | --- | --- | --- | --- |
| Newest branch (2019) | Where is West Point? | Which day honors those who died in service? | Gold bar: which rank? | Year of the first U.S. peacetime draft | Farmer who showed Curtis the way around at Westport |
| Branch under Homeland Security in peacetime | Air Force Academy's city | Original name of Veterans Day | Which outranks: Navy Captain or Army Colonel? (trick: equal) | What does *posse comitatus* mean? | Park in Kansas City near the center of the Westport fighting |
| Oldest branch | Which academy commissions Marines? | Armistice time and date | What do NCOs do? | What could a man pay in 1863 to avoid service? | River crossing fought over before Westport |
| Branch that runs GPS | Moonwalker from West Point | Third Saturday in May | Marine E-3 rank | Branch not covered by the Posse Comitatus Act | House on Wornall Road that became a field hospital |
| Members are called Guardians | Academy that produced an NBA coach | President who announced VE Day on his birthday | Only General of the Air Force | When automatic draft registration begins | Why the high ground mattered |

### 7.4 Requirement Tracker

- Leader enters boys' first names locally (never uploaded).
- Grid: boys × requirements 1–24, with states *exposed in meeting*, *explained back*, and *mentor signed*.
- Sessions auto-mark *exposed* for the modules run; the leader taps *explained back* during teach-back.
- Export CSV for Trail Life Connect entry.

---

## 8. Battle Study module

### 8.1 The planning ladder

The battle study runs as a ladder. Each rung uses a different map type and a smaller scale. The boys watch professionals plan at that scale, then plan their own capture the flag game the same way.

| Rung | Map type | Question it answers | Example | Boys do |
| --- | --- | --- | --- | --- |
| 1. Strategic | Political or regional map: states, rivers, roads, railroads | Why fight *here*, and why *now*? | The Carolinas 1780–81; Missouri 1861; the Normandy coast 1944 | Trace the campaign arrows; find the objective |
| 2. Operational | Topographic map or sand table | Where's the high ground? Who goes around whom? | Westport | Build terrain from contours; spot key terrain |
| 3. Tactical | Sketch map with unit symbols, arrows, phase lines | Who moves where, and when? | Cowpens (defense), Pegasus Bridge (offense) | Move markers phase by phase; predict before each reveal |
| 4. Their turn | Their own field sketch | How do *we* win? | Capture the flag | Terrain analysis, patrol order, play, after-action review |

Every battle is shown on screen in the map types that fit it. A toggle switches between them so boys see the same ground at different scales:
- **Strategic layer:** regional base map with campaign movement arrows.
- **Topographic layer:** contours or shaded relief from public elevation data.
- **Tactical layer:** unit markers, movement arrows, phase lines.
- **Period map layer:** a public-domain historical map of the battle, where one exists, faded under the tactical layer.

### 8.2 Battle lineup

| Battle | Role in the ladder | Size to model | Build order |
| --- | --- | --- | --- |
| **Cowpens** (Jan 17, 1781, SC) | Tactical defense. Layered lines and a trap; maps directly onto capture the flag defense. | Small: about 10 units, 5–6 phases, under an hour of battle | **First.** Smallest; proves the engine. |
| **Pegasus Bridge** (June 6, 1944, Normandy) | Tactical offense. Seize the objective by surprise, hold until relieved. The closest real-world capture the flag analog. | Small: six gliders, two bridges, about 6 phases | Second |
| **Westport** (Oct 21–23, 1864, Kansas City) | Operational level. Caught between two armies; local knowledge breaks a stalemate. The boys can visit it in an afternoon. | Medium: about 15 units, 7 phases | Third |
| **Wilson's Creek** (Aug 10, 1861, MO) | Optional operational battle; split forces. A visit isn't realistic this season. | Medium | Optional |
| **Little Round Top** (July 2, 1863, Gettysburg) | v2 alternate: flank defense; prepares for Requirement 13 | Small | Later |
| **Trenton** (Dec 26, 1776) | v2 alternate: surprise and weather | Small | Later |

Battles are chosen for the decision they teach, not their death toll. Narration stays at the level of decisions and movement, with no graphic description.

### 8.3 Can these be built accurately? Source assessment

Short answer: **yes for Cowpens, Westport, and Wilson's Creek; mostly yes for Pegasus Bridge.** Cowpens and Wilson's Creek each have a U.S. Army staff ride guide, and Westport has the Army's 2016 battlefield atlas of Price's expedition. Each has: an instructor's handbook with an order of battle (every unit and commander) and timed troop-movement maps. As government publications, those are public domain, so their maps can be redrawn. Pegasus Bridge has a well-documented timeline but relies more on secondary sources.

**Limit to state on screen:** every animation shows *approximate* positions at phase-level timing. Even the Army's own staff ride maps are reconstructions. Each phase carries a "Positions approximate, based on [source]" line.

| Battle | Confidence | Primary build sources (public domain unless noted) | Cross-check and leader "watch" links |
| --- | --- | --- | --- |
| **Cowpens** | High | [The Cowpens Staff Ride and Battlefield Tour](https://apps.dtic.mil/sti/pdfs/ADA530379.pdf) (Army Combat Studies Institute, 1996): narrative, order of battle, maps. Ed Bearss, *The Battle of Cowpens: A Documented Narrative and Troop Movement Maps* (NPS). NPS Cowpens visitor map. | [American Battlefield Trust Cowpens map](https://www.battlefields.org/learn/maps/cowpens-january-17-1781) and its Cowpens and Southern Campaign animated maps on the Trust's YouTube channel (copyrighted; link only) |
| **Westport** | High | [Battlefield Atlas of Price's Missouri Expedition of 1864](https://www.armyupress.army.mil/Portals/7/educational-services/staff-rides/StaffRideHB_AtlasofPricesMissouriExpeditionof1864.pdf) (Combat Studies Institute, 2016): staff ride atlas covering Little Blue, Independence, Byram's Ford, Westport and Mine Creek. Wikipedia order-of-battle pages; Clio marker entries. | Monnett Battle of Westport Fund tour maps; on-site markers during the visit |
| **Wilson's Creek** (optional) | High | [Wilson's Creek Staff Ride and Battlefield Tour](https://apps.dtic.mil/sti/tr/pdf/ADA530378.pdf) (Combat Studies Institute): order of battle plus timed maps for 0500–0600, 0600–0800, 0800–1000 and 1000–1130. 1865 Hoelcke battlefield map; *Official Records Atlas* plate (1891–95). NPS tour map; USGS elevation data. | [American Battlefield Trust Wilson's Creek](https://www.battlefields.org/learn/civil-war/battles/wilsons-creek) (link only); the park's fiber-optic troop movement map in the visitor center during the visit |
| **Pegasus Bridge** | Medium | [Airborne Assault Museum ParaData](https://paradata.org.uk/node/11050) accounts; period aerial photos; modern open map data for the canal, river, and roads (OpenStreetMap, attribution required) | Pegasus Memorial museum materials; published histories (copyrighted; facts only, no maps traced) |

**What's thin for Pegasus:** exact German defensive positions and the order glider by glider are less consistently documented than Civil War orders of battle. Model it at platoon level (six glider loads, two bridges), which matches capture the flag scale anyway.

**Existing animated maps:** the American Battlefield Trust has produced animated maps with troop movement and narration, including Cowpens. They're good for a leader to watch beforehand, or as a closing video. They can't replace the build because they're passive video: no decision pauses, no fog of war, and no link to the sand table. The site links to them but doesn't embed or copy them.

### 8.4 Verified battle facts

Sources disagree on strength and casualty figures. The site shows one figure with its source and notes the range.

#### Cowpens — January 17, 1781

Sources: [American Battlefield Trust](https://www.battlefields.org/learn/articles/cowpens), [Britannica](https://www.britannica.com/event/Battle-of-Cowpens), the Combat Studies Institute guide above. Verified 2026-11-03.

- **Commanders:** Brig. Gen. Daniel Morgan (American) against Lt. Col. Banastre Tarleton (British), who was 26.
- **Strength:** roughly 1,000 on each side. Sources range from about 940 to 1,100 American and 1,050 to 1,150 British.
- **Setup:** Morgan reached the Cowpens, a cattle-grazing field near the Broad River, on the night of January 16. He expected the aggressive Tarleton to charge straight in. Tarleton's men had marched through the night.
- **Morgan's three lines:**
  1. Riflemen skirmishers in front, behind trees.
  2. Militia under Andrew Pickens. Their orders were to fire two volleys at officers and then withdraw; Britannica says three volleys, so note the disagreement.
  3. Continental regulars under John Eager Howard on the rise, about 150 yards behind.
  - William Washington's cavalry was hidden behind the hill.
- **Phase flow:**
  1. Skirmishers fire and fall back.
  2. Militia fire their volleys and withdraw around the American left.
  3. British dragoons chase the militia, and Washington's cavalry strikes them.
  4. The British reach the Continentals and think the Americans are in full retreat.
  5. The Continentals turn and fire. Washington's cavalry and the re-formed militia strike both British flanks: a double envelopment.
  6. Most of the British force surrenders; Tarleton escapes.
- **Result:** decisive American victory, over by about 8:00 a.m. (Britannica). The Trust's estimates are 149 American and 868 British casualties, most of the British captured.
- **Confirm against the staff ride guide before building:**
  - The order to Howard's right flank that was misread as a retreat, which drew the British forward.
  - The claim that Morgan chose ground with a river behind him so the militia couldn't flee.
  - The Washington–Tarleton hand-to-hand clash.

#### Pegasus Bridge — June 6, 1944

**Naming note:** the Imperial War Museum calls the assault Operation Deadstick, but several histories say Deadstick was the name of the glider training exercise, and that the assault itself was part of Operation Tonga. Call it "the Pegasus Bridge glider assault" and mention the naming dispute.

Sources: [Wikipedia: Pegasus Bridge](https://en.wikipedia.org/wiki/Pegasus_Bridge), [ParaData (Airborne Assault Museum)](https://paradata.org.uk/content/4663998), [Back to Normandy](https://www.backtonormandy.org/the-history/divisions-airborne/6-airborne-division/6-airlanding-brigade-uk/2%20oxfordshire-and-buckinghamshire-light-infantry-.html). Verified 2026-11-03.

- **Force:** 181 men under Maj. John Howard. That was D Company, 2nd Oxfordshire and Buckinghamshire Light Infantry, with added platoons, Royal Engineers, and glider pilots.
- **Mission:** capture two bridges intact, over the Caen Canal and the Orne River, and hold them until relieved. That secured the eastern flank of the beach landings.
- **Timeline:**
  1. **22:56, June 5:** six Horsa gliders, towed by Halifax bombers, leave RAF Tarrant Rushton.
  2. **About 00:07:** gliders released over the coast.
  3. **00:16:** three gliders land beside the canal bridge, the closest about 47 yards away; two land at the river bridge. The sixth lands at the wrong river, about 7 miles away.
  4. **About 10 minutes later:** both bridges are taken intact, at the cost of two men killed, including Lt. Den Brotheridge. Code words "Ham and Jam" signal success.
  5. **Before dawn:** paratroopers of the 7th Parachute Battalion reinforce. German counterattacks come during the night and morning.
  6. **Early afternoon:** Lord Lovat's commandos arrive from Sword Beach, with piper Bill Millin playing.
- **Teaching hooks:**
  - **Rehearsal:** Howard's men practiced capturing bridges for months without knowing why.
  - **Surprise and speed.**
  - **Seize, then hold until relieved,** which is exactly what capture the flag needs.

#### Wilson's Creek — August 10, 1861

Sources: [American Battlefield Trust](https://www.battlefields.org/learn/civil-war/battles/wilsons-creek), [NPS Wilson's Creek](https://www.nps.gov/wicr/learn/historyculture/index.htm), [Civil War on the Western Border](https://civilwaronthewesternborder.org/encyclopedia/battle-wilsons-creek), the Combat Studies Institute guide above. Verified 2026-11-03.

- **Place:** along Wilson Creek, about 10–12 miles southwest of Springfield, MO. The first major battle west of the Mississippi.
- **Forces:** about 5,400 Union under Brig. Gen. Nathaniel Lyon, against about 11,000–12,000 Southern troops: Confederates under Brig. Gen. Ben McCulloch and Missouri State Guard under Maj. Gen. Sterling Price.
- **The plan:** the outnumbered Lyon attacked at dawn in two columns. He led the main column from the north while Col. Franz Sigel swung around to strike from the south.
- **Phase flow:**
  1. Around 5:00 a.m., Lyon hits the State Guard camps and takes the high ground later called Bloody Hill.
  2. Sigel's artillery drives Southern cavalry from their camp in the Sharp farm field.
  3. Price shifts troops from the creek valley to face Lyon.
  4. McCulloch's men surprise and overrun Sigel, whose column scatters.
  5. Southern troops assault Bloody Hill three times. During the second, Lyon is killed, the first Union general killed in the war.
  6. Low on ammunition, the Union force under Maj. Samuel Sturgis withdraws to Springfield. The final Southern attack finds the hill empty.
- **Result:** Confederate victory. The Trust's estimates are 1,235 Union and 1,095 Confederate casualties; other sources give about 1,317 and 1,222.
- **Timing:** the staff ride guide's four time blocks (0500–0600, 0600–0800, 0800–1000, 1000–1130) map onto the six teaching phases.
- **To verify before use:** the account that Sigel's men mistook an approaching Southern regiment for friendly troops because uniforms didn't yet match by side.

#### Battle of Westport — October 21–23, 1864 (the local battle)

Sources: [Civil War on the Western Border](https://civilwaronthewesternborder.org/encyclopedia/battle-westport), [Wikipedia: Battle of Westport](https://en.wikipedia.org/wiki/Battle_of_Westport) and [Battle of Byram's Ford](https://en.wikipedia.org/wiki/Battle_of_Byram%27s_Ford), [KCUR](https://www.kcur.org/community/2014-06-19/then-and-now-a-look-back-at-the-battle-of-westport), [Clio tour entries](https://theclio.com/tour/2775), and the Army's public-domain [Battlefield Atlas of Price's Missouri Expedition of 1864](https://www.armyupress.army.mil/Portals/7/educational-services/staff-rides/StaffRideHB_AtlasofPricesMissouriExpeditionof1864.pdf) (Combat Studies Institute, 2016; also at [DTIC](https://apps.dtic.mil/sti/trecms/pdf/AD1112174.pdf)). Verified 2026-11-04.

- **Why it mattered:** the largest Civil War battle west of the Mississippi, often called the "Gettysburg of the West." One historian argues it was more decisive than Gettysburg, because Price's army fell apart afterward while Lee's escaped intact.
- **The campaign (strategic map):**
  - In fall 1864, Confederate Maj. Gen. Sterling Price raided into Missouri, hoping to install a Confederate governor and hurt Lincoln's reelection.
  - He gave up on St. Louis, found Jefferson City too strong, and turned west toward Kansas City and Fort Leavenworth.
  - Price's army probably numbered 8,000–10,000 cavalry, many poorly equipped, slowed by a wagon train of captured goods. Wikipedia cites about 500 wagons and 5,000 head of cattle.
- **The trap:** Union Maj. Gen. Samuel Curtis's Army of the Border (about 15,000) stood to the west. Maj. Gen. Alfred Pleasonton's cavalry division (over 5,500) closed in from the east. Price had to beat Curtis before the two combined.
- **The local battles (all in or near Independence and Kansas City):**
  - Lexington: October 19
  - Little Blue River: October 21, a Union delaying action near Independence
  - Second Battle of Independence: October 22
  - Byram's Ford on the Big Blue River: October 22–23
  - Westport: October 23
- **Phase flow for the table:**
  1. **October 22:** Price outflanks Curtis's Big Blue River line by forcing a crossing at Byram's Ford. Curtis re-forms a new line south of Westport along Brush Creek, across from today's Country Club Plaza.
  2. **Morning, October 23:** Shelby's and Fagan's divisions attack the Brush Creek line. The fight seesaws; the Confederates have to stop for ammunition, and more Kansas militia keep arriving. It becomes a stalemate.
  3. **Shortly after 8 a.m.:** Pleasonton attacks Marmaduke at Byram's Ford from the east.
  4. **About 11 a.m.: the decision point.** Local farmer George Thoman, angry about Confederate theft, shows Curtis a creek bed at Swan Creek that leads behind the Confederate left. Curtis takes his escort and the 9th Wisconsin Battery through it. Artillery fire from the southwest plus a frontal attack by Blunt pushes Shelby south toward the Wornall House.
  5. **About 11 a.m.:** Pleasonton forces Marmaduke off the high ground beyond the ford (Potato Hill, per Wikipedia). Price is nearly surrounded from the west, north, and east.
  6. **Afternoon:** Shelby's delaying action, with his last line near the Wornall House, lets the Confederate army slip south to its wagon train.
  7. **Aftermath:** about 1,500 casualties on each side. Price lost again at Mine Creek, Kansas, on October 25 and reached Arkansas with roughly half his original force.
- **Loose Park:** sits near the center of the October 23 fighting, where the Confederates were pressed back and broken. Price is said to have watched the battle from a grove there. Its replica cannon and marker cluster include an Eagle Scout project.
- **Wornall House** (6115 Wornall Road): served as a field hospital and is now a museum.
- **Teaching hooks:**
  - **Local knowledge beats numbers:** a farmer who knew one creek bed broke the stalemate.
  - **Being caught between two forces.**
  - **A good rear guard** (Shelby) saves an army even in defeat.
  - The boys can stand on the ground afterward.
- **Unit-level data:** the Army atlas has the maps and phase positions. Wikipedia's [Union](https://en.wikipedia.org/wiki/Battle_of_Westport_order_of_battle:_Union) and [Confederate](https://en.wikipedia.org/wiki/Battle_of_Westport_order_of_battle:_Confederate) order-of-battle pages cross-check the units.

#### Wilson's Creek (kept as an optional battle)

It was fought August 10, 1861, about 10 miles southwest of Springfield, and is about 2.5–3 hours from Independence. It's still a strong table study and the only battle here at an NPS National Battlefield. Since a visit isn't realistic, Westport replaces it as the operational-level battle.

### 8.5 Digital map (on screen)

**v1: SVG maps with layer toggles**
- **Layers:** strategic, topographic, tactical, and period map (section 8.1).
- **Grid:** lettered and numbered, matching the sand table.
- **Unit markers:** rectangles with standard map symbols — infantry X, cavalry diagonal, artillery dot — and for WWII, a glider or airborne symbol. Colored by side, with sub-shades where it matters, such as McCulloch's Confederates versus Price's Missouri State Guard.
- **Playback:** phase slider with clock time; play and pause; animated movement arrows; narration on the display, leader notes on the leader view.
- **Fog of war:** show only what one commander knew, then reveal the whole field.
- **Decision points:** pause and ask "You're Tarleton. Do you charge?" or "You're Howard. Glider 6 is missing. Do you change the plan?" Patrols commit to an answer before the reveal.
- **"As a patrol order" panel:** each commander's plan restated in the same five-part order format the boys will use (section 8.8). Morgan's plan and Howard's plan become worked examples.

**v2: Leaflet real-world view** of Westport over USGS topo tiles, with the driving-tour stops, for planning the visit (section 8.12).

### 8.6 Sand table companion

**Table:** a 2×4 ft folding table, or a 3×4 ft plywood sheet, with a raised edge.

**Terrain difficulty climbs with the ladder,** which also matches limited sand:

| Battle | Terrain build | Sand needed |
| --- | --- | --- |
| Cowpens | A gentle rise and a swale; open woods | Light: one or two thin foam layers plus a sand skin |
| Pegasus Bridge | Flat; the canal and river are the obstacles | Minimal: blue felt strips for water, cardboard bridges, string for roads |
| Westport | Brush Creek valley, the ridge near Loose Park, the Big Blue bluffs at Byram's Ford | Moderate: three or four contour layers; yarn for Brush Creek, Swan Creek, and the Big Blue |

**Build method:** print the contour template tiled on letter paper, cut foam or cardboard layers, stack them, and skin with about ½ inch of kinetic sand. Lay a string grid matching the screen, with yarn for water and roads. Exaggerate the vertical scale two to three times so the boys can see the slopes.

**Markers and cards (printable DOCX):**
- Tent-fold cardstock or labels for wood blocks: symbol, unit, commander.
- Phase cards with the time, events, and marker moves by grid square. These let a leader run the table with no screen.
- Capture the flag markers in the same symbol set: flag, jail, attacker, defender, scout.

### 8.7 Battle data model

```json
// battle.json
{
  "id": "cowpens",
  "name": "Battle of Cowpens",
  "date": "1781-01-17",
  "location": "Cowpens, SC",
  "ladderRung": "tactical",
  "mapLayers": ["strategic", "topographic", "tactical", "period"],
  "grid": { "columns": "A-H", "rowCount": 6 },
  "requirements": ["22"],
  "sources": ["csi-cowpens-staff-ride", "abt-cowpens", "britannica-cowpens"],
  "positionsDisclaimer": "Positions approximate, after the Combat Studies Institute staff ride guide (1996).",
  "factIds": ["cp-date", "cp-strength", "cp-casualties"]
}

// units.json
[
  { "id": "us-skirmishers", "side": "american", "label": "Riflemen skirmishers", "type": "infantry" },
  { "id": "us-pickens-militia", "side": "american", "label": "Pickens's militia", "type": "infantry", "commander": "Andrew Pickens" },
  { "id": "us-howard-continentals", "side": "american", "label": "Continentals", "type": "infantry", "commander": "John Eager Howard" },
  { "id": "us-washington-cavalry", "side": "american", "label": "Washington's cavalry", "type": "cavalry", "commander": "William Washington" },
  { "id": "gb-tarleton-line", "side": "british", "label": "British line", "type": "infantry", "commander": "Banastre Tarleton" },
  { "id": "gb-dragoons", "side": "british", "label": "British Legion dragoons", "type": "cavalry" }
]

// phases.json (one entry shown)
[
  {
    "index": 2,
    "title": "Two volleys",
    "narration": "The militia fire at the officers, then withdraw around the American left.",
    "positions": { "us-pickens-militia": "C4" },
    "movements": [ { "unitId": "us-pickens-militia", "path": ["C3", "B4", "C5"] } ],
    "knownToBritish": ["us-skirmishers", "us-pickens-militia", "us-howard-continentals"],
    "decisionPoint": {
      "side": "british",
      "prompt": "You're Tarleton. The militia are running. Do you charge?",
      "historicalOutcome": "He charged and ran into the Continentals and a trap."
    },
    "sourceIds": ["csi-cowpens-staff-ride"],
    "factIds": ["cp-militia-volleys"]
  }
]

// patrolOrder.json (worked example rendered in the "as a patrol order" panel)
{
  "battleId": "cowpens",
  "commander": "Daniel Morgan",
  "situation": "Tarleton is aggressive, tired from a night march, and will attack head-on.",
  "mission": "Destroy Tarleton's force at the Cowpens.",
  "commandersIntent": "Make him think he's winning, then hit him from both sides.",
  "roles": [
    { "role": "Bait", "who": "Skirmishers and militia" },
    { "role": "Anchor", "who": "Continentals on the rise" },
    { "role": "Hidden strike", "who": "Washington's cavalry" }
  ],
  "signals": "Militia know in advance where to withdraw to."
}
```

Grid squares above are placeholders. Real positions come from the staff ride maps during the build.

### 8.8 Capture the flag planner (rung 4)

A planning screen that uses the same symbols and order format as the battles.

1. **Field canvas:** draw the field boundary on a blank grid, or load a photo or screenshot of the actual field, and overlay the grid.
2. **Terrain analysis:** the Army's OAKOC checklist as five prompts the patrol fills in.
   - **Observation:** where can you see from?
   - **Avenues of approach:** which ways can people come at you?
   - **Key terrain:** what ground matters most?
   - **Obstacles:** what blocks or slows movement?
   - **Cover and concealment:** where can you hide or be protected?
3. **Marker palette:** flag, jail, attacker, defender, scout, jail guard, obstacle, approach arrow, phase line.
4. **Patrol order:** Situation, Mission, Commander's intent, Roles, Signals. It's the same template as the Morgan and Howard examples, shown side by side for reference.
5. **Lock the plan** before play, with a printable plan card.
6. **After-action review:** draw what actually happened, answer the Army's four questions, and revise. Rounds 1 and 2 show side by side.
7. Everything stays local and exports as a JSON or PDF plan card. No names are needed; patrols use patrol names.

**Bridge exercise:** "Plan Pegasus as capture the flag." Show the two bridges as the flag and the German guard posts as defenders, and patrols plan the seizure *before* seeing Howard's plan. Then reveal it and compare.

### 8.9 Battle session plan (three meetings + visit)

**Battle Meeting A — Maps and Cowpens (75 min)**
- 0:00 Map types: political to topographic to tactical, using the layer toggle on Cowpens (10 min)
- 0:10 Build the Cowpens terrain on the table (15 min)
- 0:25 Unit symbols; place starting markers (10 min)
- 0:35 Tarleton's decision: one patrol plays Tarleton *before* seeing Morgan's lines (10 min)
- 0:45 Run all phases on screen and table, with decision points (20 min)
- 1:05 Morgan's plan as a patrol order (5 min)
- 1:10 Teach-back (5 min)

**Battle Meeting B — Pegasus Bridge to capture the flag (75 min, gym or field)**
- 0:00 Pegasus Bridge: the bridge exercise, then the run (15 min)
- 0:15 Walk the field: terrain analysis and field sketch (10 min)
- 0:25 Patrol orders (10 min)
- 0:35 Round 1 (8 min), review and revise (7 min), Round 2 (8 min)
- 0:58 Final review comparing both rounds (10 min). This satisfies Requirement 22.
- 1:08 Teach-back (7 min)

**Battle Meeting C — Westport (75 min).** Strategic map of Price's Raid (10 min); build the Brush Creek terrain (15 min); phases 1–3 (15 min); decision point as Curtis, with the farmer's offer (10 min); phases 4–7 (15 min); plan the visit (10 min).

**Field trip — Westport, an afternoon in Kansas City.** Loose Park, the Wornall House, and Byram's Ford, or the full 32-mile driving tour as a family trip for Requirement 14. See section 8.10.

### 8.10 Visiting Westport, and what it counts for

Everything below is in Kansas City or Independence:

| Site | What's there | Cost |
| --- | --- | --- |
| Loose Park | Center of the October 23 fighting; replica cannon; walking-tour markers | Free; open daily |
| Wornall House Museum | Field hospital during the battle; historic house museum | Small fee |
| Big Blue Battlefield Park / Byram's Ford | The river crossing fought over October 22–23; trail and 2024 interpretive markers | Free |
| 32-mile driving tour | About 25 Monnett Battle of Westport Fund markers from Independence to Westport; stops include the Little Blue and Independence battles | Free |
| Battle of Westport Visitor Center and Museum | Exhibits and tour maps | Sources disagree on its current location (Swope Park entrance versus inside Big Blue Battlefield Park). Check [battleofwestport.org](https://www.battleofwestport.org) before going. |

**Requirement fit:** read this honestly; the mentor decides.
- **Req 12:** says "visit a National Battlefield." Westport isn't an NPS National Battlefield; it's on the National Register of Historic Places. A strict reading won't count it.
- **Req 14:** "plan a family trip following the Civil War Trails; document the battlefields and historic sites." The 32-mile driving tour is a close fit, with Little Blue, Independence, Byram's Ford and Westport in one trip. This is probably the best requirement for the boys to claim from Westport.
- **Req 15:** "visit a military museum." The Battle of Westport Visitor Center and Museum, or the National WWI Museum, fits.
- **Req 17:** a patriot who died in battle. Westport doesn't have an obvious single figure the way Wilson's Creek has Lyon, so the boys may need another choice.

### 8.11 Game mode: drag, draw, and plan

The battle viewer becomes a planning game, using the same engine as the capture the flag planner.

**Modes**
- **Watch:** the current prototype behavior. History plays phase by phase.
- **Command:** at each decision point, a patrol takes control of one side. They drag their units, draw arrows, and lock the plan. Then history replays over the top, so they can compare their plan with what happened.
- **Sandbox:** everything is draggable. Leaders use it to explain; boys use it to plan capture the flag on their own field.

**Interactions**
- **Drag units** with mouse or touch. Snap to grid optional; rotate facing; tap to cycle normal, disordered, and surrendered.
- **Draw arrows:**
  - point-to-point or freehand, in side color
  - dashed for planned, solid for actual
  - curved arrows for flanking moves
- **Place symbols:** objective, flag, obstacle, phase line, fire, scout, rally point, and text notes.
- **Layers:** history, Patrol A's plan, Patrol B's plan. Toggle each, or overlay all three to compare.
- **Hidden plans:** each patrol plans while the other patrol's layer is hidden, then both reveal together.
- **Editing:** undo and redo. Save and load scenarios as JSON; export a PNG to print for the table.

**No dice or combat math.** A combat calculator invites arguments about rules and false precision. The leader acts as umpire, the way the Prussian army's original Kriegsspiel used an umpire, and history is the answer key. That keeps the focus on decisions.

**Scoring (optional):** points for holding an objective at a set time, keeping a line of retreat open, or matching a historical commander's key move. It's light-touch, to settle arguments rather than to simulate combat.

### 8.12 Terrain: showing why ground matters

**Map sources (public domain)**
- **[USGS Topo and Shaded Relief base maps](https://apps.nationalmap.gov/help/3.0%20TNM%20Base%20Maps.htm)** from The National Map: tiled services documented for use with Leaflet. These are the online "real-world" layer.
- **USGS 3DEP elevation data:** the build script downloads it once for each battle's bounding box, computes contour lines and a hillshade image, and bakes them into the SVG battle map. That way terrain works offline and matches the sand table's contour template.
- **USGS topoView historical topographic maps (1884–2006):** older Kansas City quadrangles show Brush Creek and the Big Blue valley before modern development, overlaid on the tactical map.
- **Period and Army maps:** the Combat Studies Institute atlases for positions; Library of Congress Civil War maps for period overlays.

**Terrain tools for teaching**
- **Elevation tint:** color by height, with vertical exaggeration from 1× to 5×.
- **Line of sight:** click a unit to shade what it can see. This shows why the Union guns on Bloody Hill, or a Westport ridge, mattered.
- **Elevation profile:** draw a line across the map and see the up-and-down cross-section. It's good for explaining "the high ground."
- **Slope shading:** steep ground slows movement; mark it for the umpire.

**Hosting constraint:** published claude.ai artifact pages can't load remote map tiles. Real-world tile layers work on GitHub Pages. The baked SVG terrain works everywhere, including offline.

**Westport terrain is mostly under the city now.** The topo layers are what let boys see the Brush Creek valley and the bluffs above Byram's Ford through the streets, which makes the battle study and the field trip connect.

### 8.13 Replay, intended plans, and what-ifs

The game mode has three ways to look at a battle: what happened, what each commander meant to happen, and what might have happened.

**1. Replay: what actually happened**
- **Timeline scrubber:** units move smoothly between phases, not just jumping phase to phase. Play, pause, step, and speed (½×, 1×, 2×).
- **Trails:** each unit leaves a faint path, so after playback the whole battle's movement shows at once, like a time-lapse.
- **Clock and narration** stay synced to the scrubber; scrubbing backward undoes moves cleanly.
- **Jump points:** a click jumps to any phase or decision point.
- **Compare:** replay history over a patrol's own Command-mode plan, to see where theirs went differently.

**2. Intended plans: what each commander meant to do**

These display only where sources document the plan. Each plan gets its own layer in dashed brass, labeled with the commander's name and the source:

| Battle | Side | Documented intent | Source basis |
| --- | --- | --- | --- |
| Cowpens | American | Morgan's three layered lines, planned militia withdrawal, hidden cavalry | Staff ride guide; Morgan's own account |
| Cowpens | British | Tarleton's direct frontal attack to catch Morgan before he crossed the Broad River | Staff ride guide |
| Pegasus Bridge | British | Operation Deadstick: six gliders, three per bridge; seize both intact; hold until relieved | ParaData; published histories |
| Westport | Confederate | Price: beat Curtis's less-experienced army first, then turn on Pleasonton before they combine | Civil War on the Western Border; Army atlas |
| Westport | Union | Curtis: hold the Brush Creek line while Pleasonton closes from the east | Same |

**Plan vs. reality view:** the intended-plan layer and the actual replay side by side, or overlaid. The "why was there a difference?" question from the after-action review is built into the screen.

**3. What-ifs: alternate outcomes, clearly labeled**

A what-if forks from a decision point, changes one thing, and plays out alternate phases.

**Rules so what-ifs teach rather than mislead:**
- **Labeled, every time:** a "What-if: not history" banner, a different marker style (hollow, dotted), and a separate timeline branch.
- **One change per what-if,** at a documented decision point.
- **Reasoning shown:** every alternate outcome lists *why* in two or three bullets. The bullets rest on facts from the real battle (numbers, terrain, timing) and on principles the boys already know: surprise, high ground, reserves, communication.
- **Confidence label:** each what-if is tagged as one of:
  - **Historians argue this** (a published historian has suggested it; cite them)
  - **Likely**
  - **Open question** (use as a discussion prompt with no single answer)
- **No invented precision:** alternate outcomes stay at the level of "held the line" or "probably escaped," never invented casualty counts.
- **Two endings when it's genuinely unclear.** For "open question" what-ifs, the boys argue for one before seeing the reasoning.

**Starter what-ifs** (each still needs its reasoning sourced during the build):

| Battle | Fork point | Change | Likely direction | Confidence |
| --- | --- | --- | --- | --- |
| Cowpens | 07:00 | Tarleton rests his men and scouts before attacking | Morgan's trap depends on a fast frontal attack. A slower, scouted attack might spot the hidden cavalry or flank the lines, and the battle likely becomes a closer fight or a British advantage. | Likely |
| Cowpens | 07:30 | The militia break and flee instead of re-forming | There's no second flank attack, so the envelopment closes on only one side and the Continentals face the full British line. The outcome is uncertain. | Open question |
| Cowpens | 07:40 | Morgan stops the mistaken retreat on the spot | The line stays engaged and the British don't rush forward in disorder, which removes the surprise volley. | Open question |
| Pegasus Bridge | 00:16 | The gliders land farther from the bridges, as the sixth one did | Surprise depends on landing yards away. More distance means defenders get time to react, and possibly to destroy a bridge. | Likely |
| Pegasus Bridge | Morning | Relief is delayed past midday | A small force holds against counterattacks for longer; whether the bridges hold is the discussion. | Open question |
| Westport | ~11 a.m. | No farmer shows Curtis the creek bed | The Brush Creek stalemate continues longer; Pleasonton's pressure from the east still threatens Price. Did Thoman change the result, or just the timing? | Open question |
| Westport | Oct 22 | Price abandons his wagon train to move faster | His army is lighter and harder to trap, but gives up the captured supplies the raid was partly about. | Historians argue this (find a citation in the Army atlas or Sinisi's *The Last Hurrah*) |

**Data model addition** (in `battles/<id>/`):

```json
// plans.json
[{ "side": "american", "commander": "Daniel Morgan", "label": "Morgan's plan",
   "arrows": [...], "positions": {...}, "notes": "...", "sourceIds": ["csi-cowpens-staff-ride"] }]

// whatifs.json
[{ "id": "cp-tarleton-waits", "title": "What if Tarleton waited?",
   "forkPhase": 1, "change": "Tarleton rests his men and scouts the American position.",
   "confidence": "likely",
   "reasoning": ["Morgan's trap relied on a fast frontal attack (staff ride guide).", "Washington's cavalry was hidden behind the rise; scouts could have found it."],
   "reasoningSourceIds": ["csi-cowpens-staff-ride"],
   "phases": [ { "title": "...", "narration": "...", "positions": {...}, "movements": [...] } ],
   "discussion": "Which would you rather face: a fast, tired enemy or a slow, rested one?" }]
```

`check-sources.js` requires `reasoningSourceIds` on every what-if and refuses a what-if without a `confidence` label.

---

## 9. Content to migrate

Already written and verified in the leader guide and the follow-up discussion:

**9.1 Meeting 1 modules:** Five or Six opener; Branch Timeline Race; Academy Run-and-Sort; Floor Calendar and GI Bill story; Tomb Guard Walk; Veteran Guest Q&A; Teach-back.

**9.2 Meeting 2 modules:** Birthday Draft Lottery; Who Can Respond (Posse Comitatus); Rank Ladder Race; Strategy Session and Capture the Flag with after-action review; Armor of God.

**9.3 Reference content from the follow-up discussion**
- Branch founding order and dates, with the Navy and Marine re-establishment wrinkle
- Role, purview and limits of each branch, plus the National Guard note
- 16 "Which Branch?" scenarios: 8 clear-cut, 5 trickier, 3 debate rounds
- Special operations units by branch, member names, and rank differences, including the Captain and Staff Sergeant gotchas and the five-star holders
- Full list of military holidays and observances, branch birthdays, plus Flag Day, Pearl Harbor, D-Day, VE Day and VJ Day, with the Truman/Independence tie
- Leader fact sheet tables: branches, academies, holidays, Arlington, GI Bill, conscription, Posse Comitatus, Army ranks

---

## 10. Picture ID research plan

Research images during the build, with license metadata per image (section 6.4).

| Category | Examples | Preferred sources |
| --- | --- | --- |
| Branch emblems | Six seals or emblems | Official branch .mil sites |
| Rank insignia | Army enlisted and officer; Navy chevrons and collar devices | Branch .mil sites, DoD rank charts |
| Aircraft | F-35, B-2, C-17, AH-64 Apache, V-22 Osprey, MH-60 Jayhawk | [DVIDS](https://www.dvidshub.net/) |
| Ships and vehicles | Aircraft carrier, submarine, Coast Guard cutter, icebreaker, M1 Abrams, amphibious vehicle | DVIDS, navy.mil, uscg.mil |
| Memorials | Tomb of the Unknown Soldier, Marine Corps War Memorial (Iwo Jima), National WWI Memorial in KC, Wilson's Creek | NPS, Library of Congress |
| Historical | Civil War uniforms, WWI doughboys, D-Day landing craft, Truman in WWI | [Library of Congress](https://www.loc.gov/pictures/), [National Archives](https://catalog.archives.gov/) |
| Battle maps | Westport and Price's Raid maps; USGS historical Kansas City quadrangles | Combat Studies Institute atlas, Library of Congress, USGS topoView |

Avoid graphic combat photos. Pick images that teach identification, not gore.

---

## 11. Build phases

Each phase ends with something usable at a real meeting.

| Phase | Deliverable | Done when |
| --- | --- | --- |
| **0. Scaffold** | Repo, folder layout, data schemas, source-check script, README | `npm run check` fails on a fact without a source |
| **1. Navigator + presenter** | Meetings 1 and 2 as sequences; module pages; two-window mode; timer; short-on-time toggle | A leader runs Meeting 1 from the laptop with the projector showing no answers early |
| **2. Sequence builder + tracker** | Library filters, drag-to-build, save/export/import, requirement coverage strip, local tracker | A second leader builds a custom 60-minute sequence and shares it by link |
| **3. Games** | Jeopardy, Which Branch?, Rank Ladder, Who Outranks Whom?, Timeline, Holiday Calendar | Full Jeopardy game with two patrols, Daily Double and Final, scores persisting through a page refresh |
| **4a. Battle engine + Cowpens** | Port `prototype/cowpens-prototype.html` into the engine: data into `content/battles/cowpens/*.json`, code into `src/battle/` modules. Keep its map-type toggle, decision points, Tarleton's-view fog, table moves, and patrol-order panel | Cowpens plays start to finish from data files; every phase cites the staff ride guide |
| **4b. Pegasus Bridge** | Second battle from data files only | Added without changing engine code |
| **4c. Westport** | Third battle from the Price's Expedition atlas; strategic layer of the raid; the Thoman decision point | All seven phases play; units match the atlas and order-of-battle pages |
| **4e. Game mode** | Command and Sandbox modes, dragging, arrows, symbols, layers, hidden plans, undo, save, PNG export (section 8.11) | Two patrols plan Cowpens separately, reveal, and compare against history |
| **4g. Replay, plans, what-ifs** | Smooth replay with trails and speed; intended-plan layers; plan-vs-reality view; what-if branches with banner, confidence label and reasoning (section 8.13) | Cowpens plays history, Morgan's and Tarleton's plans, and one what-if end to end |
| **4f. Terrain pipeline** | Baked 3DEP contours and hillshade per battle; line of sight; elevation profile; USGS tile layer online (section 8.12) | Westport terrain renders offline; line of sight works from any unit |
| **4d. Capture the flag planner** | Field canvas, terrain-analysis prompts, markers, patrol order, lock, after-action compare | A patrol plans, plays two rounds, and compares plans on screen |
| **5. Printables** | DOCX card decks, unit markers, phase cards, contour template | Markers and phase cards print and cut cleanly on letter paper |
| **6. Picture ID** | Image manifest with licenses; game mode | 30+ images, each with credit and license; offline build includes all re-hostable images |
| **7. Offline build** | Single-file `dist/military-heritage.html` | Opens on a laptop with Wi-Fi off and runs Meeting 1 and the battle |
| **8. v2** | Leaflet real-world view of Westport with tour stops; Wilson's Creek, Little Round Top and Trenton data; optional keyboard buzzers | New battles added without changing engine code |

---

## 12. Claude Code kickoff prompt

Paste into Claude Code from the repo root after committing this file as `PLAN.md`:

> Read PLAN.md fully. We're building this in phases; do Phase 0 only, then stop and show me the folder layout, the JSON schemas, and the source-check script before going further.
>
> Constraints: vanilla JavaScript with ES modules, no framework, readable variable names, no minification. Every fact must have a source URL and a verified date, enforced by the check script. Don't reproduce Trail Life badge text verbatim; paraphrase requirements.
>
> For historical content in later phases, web-verify facts before writing them into data files, and flag any source disagreements rather than picking one silently. For battle positions, work from the public-domain Combat Studies Institute staff ride guides linked in section 8.3, and never trace copyrighted maps.

---

## 13. Open decisions

- [ ] Public repo with paraphrased requirements, or private repo with verbatim text?
- [ ] How much kinetic sand you have; this sets table size and scale
- [ ] Projector, TV, or both at the meeting location? Is there Wi-Fi?
- [ ] Is a second leader available to run the sand table while you run the screen?
- [ ] Westport visit: afternoon at Loose Park, Wornall House, and Byram's Ford, or the full driving tour? Will the mentor count it for 14 or 15, given 12's "National Battlefield" wording?
- [ ] Is a gym or lit field available for Battle Meeting B in November darkness?
- [ ] Do you want the American Battlefield Trust animated maps linked as optional leader prep videos?
- [ ] Should Paul Whitsell or Nathan Gearke get repo access as co-editors?
