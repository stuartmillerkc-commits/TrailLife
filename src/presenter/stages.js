// A module is shown on the projector as a short series of "stages":
//
//   1. the opening screen (headline, body, bullet points)
//   2. one stage per prompt (a graduate to sort, a scenario to judge), if the module has prompts
//   3. the answer key as its own stage, if the module has both prompts and an answer key
//
// → moves to the next stage, then on to the next module. R reveals the current stage's answer.
// A module without prompts keeps its answer key on the opening screen, so R reveals it there.
// reveal.afterPrompt says where the answer-key stage goes (0 = straight after the opening screen).

export function buildStages(module) {
  const prompts = module.prompts || [];
  const reveal = module.reveal || null;
  const promptLabel = module.promptLabel || "Question";

  if (prompts.length === 0) {
    return [{ kind: "intro", hasAnswer: Boolean(reveal), label: "Opening screen" }];
  }

  const stages = [{ kind: "intro", hasAnswer: false, label: "Opening screen" }];
  const answerKeyStage = { kind: "answer-key", hasAnswer: true, label: reveal?.title || "Answer key" };
  const answerKeyAfter = reveal ? (reveal.afterPrompt ?? prompts.length) : null;

  if (answerKeyAfter === 0) stages.push(answerKeyStage);
  prompts.forEach((prompt, promptIndex) => {
    stages.push({
      kind: "prompt",
      promptIndex,
      hasAnswer: true,
      label: `${promptLabel} ${promptIndex + 1} of ${prompts.length}`
    });
    if (answerKeyAfter === promptIndex + 1) stages.push(answerKeyStage);
  });
  return stages;
}
