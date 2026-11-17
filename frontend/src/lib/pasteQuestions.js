// Reads a quiz a specialist pasted from Word, Google Docs or a text file into
// multiple-choice questions, and says what's wrong with any it can't use.
//
//   1. Which function adds up a range of numbers?
//   a. AVERAGE
//   *b. SUM            <- a * marks the correct choice (before or after it)
//   c. COUNT
//   Answer: b          <- or an Answer line
//
// Blank lines don't matter (Word and Google Docs often add them): a new
// question starts on the first line after a question's choices.

export const MAX_PROMPT = 1000;
export const MAX_CHOICE = 190;

const NUM_RE = /^(?:q\s*)?(\d{1,3})\s*[.)]\s*(.+)$/i;
const ANSWER_RE = /^(?:correct\s+)?(?:answer|ans)\s*[:.\-–]\s*\(?([a-h])\b/i;
const CHOICE_RE = /^(\*\s*)?\(?([a-h])[.)]\s*(.*)$/i;
const MARK_END = /\s*(\*|✓|✔|\(correct\))\s*$/i;

export const samePrompt = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();

function readChoice(line) {
  const match = CHOICE_RE.exec(line);
  if (!match) return null;
  let text = match[3].trim();
  let marked = Boolean(match[1]);
  if (MARK_END.test(text)) { marked = true; text = text.replace(MARK_END, '').trim(); }
  if (text.startsWith('*')) { marked = true; text = text.slice(1).trim(); }
  return { letter: match[2].toLowerCase(), text, marked };
}

// The pasted text in blocks: { prompt, choices, answer, start, end }, where
// start and end are the block's first and last line in the text.
function readBlocks(text) {
  const blocks = [];
  let current = null;
  text.replace(/\r\n?/g, '\n').split('\n').forEach((raw, index) => {
    const line = raw.replace(/ /g, ' ').replace(/\t/g, ' ').trim();
    if (!line) return;
    const answer = ANSWER_RE.exec(line);
    if (answer && current) { current.answer = answer[1].toLowerCase(); current.end = index; return; }
    const choice = readChoice(line);
    if (choice && current && !current.answer) { current.choices.push(choice); current.end = index; return; }
    if (choice) { current = { prompt: '', choices: [choice], answer: null, start: index, end: index }; blocks.push(current); return; }
    const numbered = NUM_RE.exec(line);
    if (!current || current.choices.length || current.answer || numbered) {
      current = { prompt: numbered ? numbered[2].trim() : line, choices: [], answer: null, start: index, end: index };
      blocks.push(current);
      return;
    }
    current.prompt += ` ${line}`;
    current.end = index;
  });
  return blocks;
}

function problemWith(block) {
  const { prompt, choices } = block;
  if (!prompt) return { problem: 'No question text. Write the question on the line above its choices.' };
  if (!choices.length) return { problem: 'No choices found. Start each choice with a., b., c. or d.' };
  if (choices.length === 1) return { problem: 'Only 1 choice. Add at least one more.' };
  if (choices.length > 4) return { problem: `Has ${choices.length} choices. Keep it to 4 or fewer.` };
  const empty = choices.find((choice) => !choice.text);
  if (empty) return { problem: `Choice ${empty.letter} is empty.` };
  if (prompt.length > MAX_PROMPT) return { problem: `The question is longer than ${MAX_PROMPT.toLocaleString()} characters.` };
  const long = choices.find((choice) => choice.text.length > MAX_CHOICE);
  if (long) return { problem: `Choice ${long.letter} is longer than ${MAX_CHOICE} characters.` };

  const marked = choices.map((choice, index) => (choice.marked ? index : -1)).filter((index) => index >= 0);
  if (block.answer) {
    const index = choices.findIndex((choice) => choice.letter === block.answer);
    if (index < 0) return { problem: `The answer says ${block.answer}, but there's no choice ${block.answer}.` };
    if (marked.length && !marked.includes(index)) return { problem: 'The * and the Answer line point to different choices. Keep one.' };
    return { correct: index };
  }
  if (marked.length > 1) return { problem: 'More than one choice has a *. Mark only the correct one.' };
  if (marked.length === 1) return { correct: marked[0] };
  return { problem: 'No correct answer. Put * before the right choice, or add a line like Answer: b.' };
}

// Each question: { prompt, options, correctOption, problem, start, end }.
// problem is null when the question is ready to add. existingPrompts are the
// questions already saved, so pasting the same quiz twice doesn't double them.
export function readPastedQuestions(text, existingPrompts = []) {
  const existing = new Set(existingPrompts.map(samePrompt));
  const seen = new Set();
  return readBlocks(text).map((block) => {
    let { problem, correct } = problemWith(block);
    const key = samePrompt(block.prompt);
    if (!problem && existing.has(key)) problem = 'This question is already saved.';
    else if (!problem && seen.has(key)) problem = 'This question is in the box twice.';
    if (!problem) seen.add(key);
    return {
      prompt: block.prompt,
      options: block.choices.map((choice) => choice.text),
      correctOption: problem ? -1 : correct,
      problem: problem || null,
      start: block.start,
      end: block.end,
    };
  });
}

// The text of the questions that weren't added, so they stay in the box.
export function leftoverText(text, questions) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  return questions.map((question) => lines.slice(question.start, question.end + 1).join('\n')).join('\n\n');
}

// Where a question sits in the text: [first character, last character].
export function rangeOf(text, question) {
  const lines = text.split('\n');
  let start = 0;
  for (let index = 0; index < question.start; index += 1) start += lines[index].length + 1;
  let end = start;
  for (let index = question.start; index <= question.end; index += 1) end += lines[index].length + 1;
  return [start, Math.max(start, end - 1)];
}
