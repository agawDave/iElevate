import { useRef } from 'react';

// The choices of a multiple-choice question: four boxes ready to type in
// (empty ones are left out when saving), a radio to mark the correct one, and
// Enter to jump to the next box. Enter in the last box saves the question.

export const CHOICE_BOXES = 4;
const letter = (index) => String.fromCharCode(65 + index);

// A saved question's choices, in four boxes.
export const fillChoiceBoxes = (options = []) => [...options, ...Array(CHOICE_BOXES).fill('')].slice(0, CHOICE_BOXES);

export const filledChoiceCount = (options) => options.filter((option) => option.trim()).length;

// The choices to save: the filled boxes, with the correct one's new position.
export function packChoices(options, correctOption) {
  const filled = [];
  let correct = -1;
  options.forEach((option, index) => {
    const text = option.trim();
    if (!text) return;
    if (index === correctOption) correct = filled.length;
    filled.push(text);
  });
  if (filled.length < 2) return { error: 'Fill in at least 2 choices.' };
  if (correct < 0) return { error: 'The choice marked correct is empty. Mark a choice that has text.' };
  return { options: filled, correctOption: correct };
}

// Enter in the question box jumps to the first choice (Shift+Enter adds a line).
export function enterGoesTo(target) {
  return (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      target.current?.focus();
    }
  };
}

export default function ChoiceInputs({ name, options, correctOption, onChange, firstRef }) {
  const boxes = useRef([]);
  const setOption = (index, value) => onChange({ options: options.map((option, i) => (i === index ? value : option)) });
  function next(event, index) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    if (index < options.length - 1) boxes.current[index + 1]?.focus();
    else event.currentTarget.form?.requestSubmit();
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">Choices <span className="font-normal text-slate-500">(mark the correct one)</span></legend>
      <div className="mt-1 space-y-2">
        {options.map((option, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              checked={correctOption === index}
              onChange={() => onChange({ correctOption: index })}
              aria-label={`Choice ${letter(index)} is correct`}
              className="h-4 w-4 shrink-0 accent-emerald-600"
            />
            <input
              ref={(element) => {
                boxes.current[index] = element;
                if (index === 0 && firstRef) firstRef.current = element;
              }}
              value={option}
              onChange={(event) => setOption(index, event.target.value)}
              onKeyDown={(event) => next(event, index)}
              maxLength={190}
              placeholder={index < 2 ? `Choice ${letter(index)}` : `Choice ${letter(index)} (optional)`}
              aria-label={`Choice ${letter(index)}`}
              className="block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200"
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-slate-500">Empty choices are left out. Press Enter to jump to the next box.</p>
    </fieldset>
  );
}
