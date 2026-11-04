// The leader-only parts of a module page: script, discussion answers, answer key,
// materials, notes and the facts behind it all. These are drawn in the leader window
// only and never go into a projector snapshot.

import { makeDetails, makeElement, makeExternalLink } from "./dom.js";
import { renderAnswer } from "./display-renderer.js";

// "Req 1 · 15 min · competition, hands-on · indoor". Pass withRequirements: false when badges show them.
export function describeModuleMeta(module, { withRequirements = true } = {}) {
  const requirementText = module.requirements.length ? `Req ${module.requirements.join(", ")}` : "No requirement";
  return [withRequirements ? requirementText : null, `${module.durationMinutes} min`, module.activityType.join(", "), module.setting].filter(Boolean).join(" · ");
}

export function renderRequirementBadges(module) {
  return makeElement("span", { className: "badges" }, module.requirements.map((number) =>
    makeElement("span", { className: "badge", text: `Req ${number}`, attributes: { title: `Badge requirement ${number}. Official wording is on Trail Life Connect.` } })
  ));
}

// The collapsible panels under the projector preview.
export function renderLeaderPanels(module, content) {
  const panels = [];

  if (module.leaderScript?.length) {
    panels.push(makeDetails("Leader script", [
      makeElement("ol", {}, module.leaderScript.map((line) => makeElement("li", { text: line })))
    ], { open: true }));
  }

  if (module.discussionQuestions?.length) {
    panels.push(makeDetails(`Discussion questions (${module.discussionQuestions.length})`, [
      makeElement("ol", { className: "discussion-list" }, module.discussionQuestions.map((item) => makeElement("li", {}, [
        makeElement("p", { className: "question", text: item.question }),
        item.answer ? makeElement("p", { className: "leader-answer", text: `Answer: ${item.answer}` }) : null
      ])))
    ]));
  }

  if (module.prompts?.length) {
    panels.push(makeDetails(`All ${module.promptLabel ? `${module.promptLabel.toLowerCase()}s` : "prompts"} and answers (${module.prompts.length})`, [
      makeElement("ol", { className: "prompt-list" }, module.prompts.map((prompt) => makeElement("li", {}, [
        makeElement("p", { className: "question", text: prompt.text }),
        makeElement("p", { className: "leader-answer", text: prompt.answer })
      ])))
    ]));
  }

  if (module.reveal) {
    panels.push(makeDetails("Answer key (leader view)", [renderAnswer(copyRevealForLeader(module.reveal))]));
  }

  const practical = [];
  if (module.materials?.length) practical.push(makeElement("h3", { text: "Materials" }), makeElement("ul", {}, module.materials.map((item) => makeElement("li", { text: item }))));
  if (module.ifShortOnTime) practical.push(makeElement("h3", { text: "If short on time" }), makeElement("p", { text: module.ifShortOnTime }));
  if (module.lowVolunteerNote) practical.push(makeElement("h3", { text: "One leader?" }), makeElement("p", { text: module.lowVolunteerNote }));
  if (practical.length) panels.push(makeDetails("Materials and notes", practical));

  if (module.factIds?.length) panels.push(renderFactsPanel(module.factIds, content));

  if (module.moreInfo?.length) {
    panels.push(makeElement("p", { className: "more-info" }, [
      "More info: ",
      ...module.moreInfo.flatMap((link, index) => [index ? " · " : "", makeExternalLink(`${link.label} ↗`, link.url)])
    ]));
  }
  return panels;
}

// Every fact the module uses, with its source and the date it was checked.
// Unverified facts are flagged so the leader knows not to state them as settled.
function renderFactsPanel(factIds, content) {
  const items = factIds.map((factId) => {
    const fact = content.facts.get(factId);
    if (!fact) return makeElement("li", { text: `Missing fact: ${factId}` });
    const source = fact.source || content.sources.get(fact.sourceId);
    const meta = makeElement("p", { className: "card-meta" });
    if (fact.needsVerification) {
      meta.append(makeElement("strong", { className: "unverified", text: "Not yet verified. " }));
    } else if (source) {
      meta.append("Source: ", makeExternalLink(source.title, source.url), fact.sourceLocation ? ` (${fact.sourceLocation})` : "", ` · checked ${fact.verifiedOn}`);
    }
    return makeElement("li", {}, [
      makeElement("p", { text: fact.statement }),
      meta,
      fact.disagreement ? makeElement("p", { className: "disagreement", text: `Sources disagree. ${fact.disagreement.siteDisplays} Other version: ${fact.disagreement.alternatives.map((alternative) => alternative.statement).join(" / ")}` }) : null,
      fact.leaderNote ? makeElement("p", { className: "leader-note", text: fact.leaderNote }) : null
    ]);
  });
  return makeDetails(`Facts and sources (${factIds.length})`, [makeElement("ul", { className: "fact-list" }, items)]);
}

// Same shape the projector gets, so one renderer draws both.
function copyRevealForLeader(reveal) {
  return {
    type: reveal.type,
    title: reveal.title || "",
    text: reveal.text,
    items: reveal.items,
    table: reveal.table ? { columns: reveal.table.columns, rows: reveal.table.rows.map((row) => row.cells) } : undefined
  };
}
