// Deep links. Every page has its own address after the "#", so it works on GitHub Pages
// and in the offline file (neither has a server that can route paths).
//
//   #/                                       Home
//   #/lead                                   Meeting list
//   #/lead/meeting-1-who-serves              Meeting 1, step 1
//   #/lead/meeting-1-who-serves/3            Step 3 (counted from 1, so a leader can text "step 3")
//   #/lead/meeting-1-who-serves/3?short=on   Same, with Short on time turned on
//   #/modules                                Module library
//   #/module/academy-run-and-sort            One module page
//   #/display                                The projector window
//
// Later phases add #/game/<id> and #/battle/<id>/phase/<n> in the same style.

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Turn a hash like "#/lead/meeting-1-who-serves/3?short=on" into a route object.
// Unknown addresses become { name: "not-found" } so the page can say so.
export function parseHash(hash) {
  const withoutMark = (hash || "").replace(/^#/, "");
  const [pathPart, queryPart = ""] = withoutMark.split("?");
  const parts = pathPart.split("/").filter(Boolean);
  const query = new URLSearchParams(queryPart);

  if (parts.length === 0) return { name: "home" };
  const [first, second, third] = parts;

  if (first === "display" && parts.length === 1) return { name: "display" };
  if (first === "modules" && parts.length === 1) return { name: "library" };
  if (first === "module" && parts.length === 2 && ID_PATTERN.test(second)) return { name: "module", moduleId: second };
  if (first === "lead") {
    if (parts.length === 1) return { name: "meetings" };
    if (!ID_PATTERN.test(second) || parts.length > 3) return { name: "not-found" };
    const route = { name: "lead", sequenceId: second, stepNumber: 1 };
    if (third !== undefined) {
      const stepNumber = Number(third);
      if (!Number.isInteger(stepNumber) || stepNumber < 1) return { name: "not-found" };
      route.stepNumber = stepNumber;
      route.stepGiven = true; // the link names a step, so it wins over where the leader last was
    }
    if (query.has("short")) route.shortOnTime = query.get("short") === "on";
    return route;
  }
  return { name: "not-found" };
}

// The reverse of parseHash, so links are always written the same way.
export function buildHash(route) {
  switch (route.name) {
    case "home": return "#/";
    case "meetings": return "#/lead";
    case "library": return "#/modules";
    case "module": return `#/module/${route.moduleId}`;
    case "display": return "#/display";
    case "lead": {
      const stepPart = route.stepNumber && route.stepNumber > 1 ? `/${route.stepNumber}` : "";
      const shortPart = route.shortOnTime ? "?short=on" : "";
      return `#/lead/${route.sequenceId}${stepPart}${shortPart}`;
    }
    default: return "#/";
  }
}
