// The simple pages: home, the meeting list, the module library, and "not found".
// Phase 2 adds library filters and the sequence builder.

import { buildHash } from "../router.js";
import { makeElement } from "./dom.js";
import { describeModuleMeta } from "./leader-panels.js";

function pageShell(root, title, children) {
  document.body.className = "page-mode";
  document.title = title === "Home" ? "Military Heritage Trail Badge" : `${title} — Military Heritage`;
  root.replaceChildren(
    makeElement("header", { className: "site-header" }, [
      makeElement("p", { className: "breadcrumb" }, title === "Home" ? [] : [makeElement("a", { text: "Home", attributes: { href: buildHash({ name: "home" }) } }), ` › ${title}`]),
      makeElement("h1", { text: title === "Home" ? "Military Heritage Trail Badge" : title }),
      title === "Home" ? makeElement("p", { text: "Lesson tools for Trail Life USA Troop MO-8605" }) : null
    ]),
    makeElement("main", { attributes: { id: "main", tabindex: "-1" } }, children),
    makeElement("footer", { className: "site-footer" }, [
      makeElement("p", { text: "Requirements are paraphrased. See Trail Life Connect for the official badge wording." })
    ])
  );
}

function meetingCards(content) {
  return makeElement("ul", { className: "card-list" }, [...content.sequences.values()].map((sequence) => {
    const requirementNumbers = [...new Set(sequence.steps.flatMap((step) => content.modules.get(step.moduleId)?.requirements || []))]
      .sort((first, second) => Number(first) - Number(second));
    return makeElement("li", {}, [
      makeElement("h3", {}, [makeElement("a", { text: sequence.title, attributes: { href: buildHash({ name: "lead", sequenceId: sequence.id }) } })]),
      makeElement("p", { className: "card-meta", text: `${sequence.totalMinutes || ""} min · ${sequence.steps.length} steps · Req ${requirementNumbers.join(", ")}` }),
      sequence.notes ? makeElement("p", { text: sequence.notes }) : null
    ]);
  }));
}

export function renderHome(root, content) {
  pageShell(root, "Home", [
    makeElement("section", { attributes: { "aria-labelledby": "lead-heading" } }, [
      makeElement("h2", { text: "Lead a meeting", attributes: { id: "lead-heading" } }),
      meetingCards(content)
    ]),
    makeElement("section", { attributes: { "aria-labelledby": "more-heading" } }, [
      makeElement("h2", { text: "More", attributes: { id: "more-heading" } }),
      makeElement("ul", {}, [
        makeElement("li", {}, [makeElement("a", { text: "Module library", attributes: { href: buildHash({ name: "library" }) } })])
      ])
    ]),
    makeElement("section", { className: "how-to", attributes: { "aria-labelledby": "how-heading" } }, [
      makeElement("h2", { text: "Running a meeting with a projector", attributes: { id: "how-heading" } }),
      makeElement("ol", {}, [
        makeElement("li", { text: "Open a meeting, then press “Open display window.”" }),
        makeElement("li", { text: "Drag the new window onto the projector and press F there for full screen." }),
        makeElement("li", { text: "Drive from either window: → next, ← back, Space timer, R reveal, B blank." }),
        makeElement("li", { text: "The projector only ever shows what’s in the preview on your screen. Answers stay hidden until you press R." })
      ])
    ])
  ]);
}

export function renderMeetings(root, content) {
  pageShell(root, "Lead a meeting", [meetingCards(content)]);
}

export function renderLibrary(root, content) {
  const modules = [...content.modules.values()];
  pageShell(root, "Module library", [
    makeElement("p", { className: "card-meta", text: `${modules.length} modules. Filters and the sequence builder arrive in Phase 2.` }),
    makeElement("ul", { className: "card-list" }, modules.map((module) => makeElement("li", {}, [
      makeElement("h3", {}, [makeElement("a", { text: module.title, attributes: { href: buildHash({ name: "module", moduleId: module.id }) } })]),
      makeElement("p", { className: "card-meta", text: describeModuleMeta(module) }),
      makeElement("p", { text: module.displayContent.headline })
    ])))
  ]);
}

export function renderNotFound(root, message) {
  pageShell(root, "Not found", [
    makeElement("p", { text: message }),
    makeElement("p", {}, [makeElement("a", { text: "Go to the home page", attributes: { href: buildHash({ name: "home" }) } })])
  ]);
}

export function renderError(root, message) {
  pageShell(root, "Something went wrong", [makeElement("p", { className: "error-message", text: message })]);
}
