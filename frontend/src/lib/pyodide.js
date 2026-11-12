const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js';

let pyodideReady;

// Loads the Pyodide (Python-in-WebAssembly) runtime once and reuses it for every
// coding exercise on the page. Runs entirely in the learner's own browser tab, so
// there is no server-side code execution involved.
export function getPyodide() {
  if (!pyodideReady) {
    pyodideReady = new Promise((resolve, reject) => {
      if (window.loadPyodide) {
        window.loadPyodide().then(resolve, reject);
        return;
      }
      const script = document.createElement('script');
      script.src = PYODIDE_CDN;
      script.onload = () => window.loadPyodide().then(resolve, reject);
      script.onerror = () => reject(new Error('Could not load the Python runtime. Check your connection and try again.'));
      document.body.appendChild(script);
    });
  }
  return pyodideReady;
}

function pyStringLiteral(value) {
  return JSON.stringify(String(value));
}

// Runs the learner's code against a set of tests. Each test's `assertion` field
// is a full Python boolean expression authored by the specialist (e.g.
// "add(2, 3) == 5"), evaluated inside Pyodide against the learner's own code.
export async function runCodeTests({ code, tests }) {
  const pyodide = await getPyodide();
  // test.id must keep its original type (number, from the DB) as it round-trips
  // through the Python harness and back — JSON.stringify (not pyStringLiteral)
  // emits it as a bare literal (e.g. 21, not "21") so identity checks against the
  // original `tests` array (===) still match once parsed back out of Python.
  const casesLiteral = tests
    .map((test) => `(${JSON.stringify(test.id)}, ${pyStringLiteral(test.assertion)})`)
    .join(',\n        ');

  const script = `
def __run_exercise():
    import json

    __scope = {}
    exec(compile(${pyStringLiteral(code)}, '<learner-code>', 'exec'), __scope)

    cases = [
        ${casesLiteral || ''}
    ]
    results = []
    for test_id, assertion_src in cases:
        entry = {"id": test_id}
        try:
            entry["passed"] = bool(eval(assertion_src, __scope))
        except Exception as e:
            entry["passed"] = False
            entry["error"] = str(e)
        if not entry["passed"] and "error" not in entry and "==" in assertion_src:
            lhs = assertion_src.split("==", 1)[0].strip()
            try:
                entry["actual"] = repr(eval(lhs, __scope))
            except Exception:
                pass
        results.append(entry)
    return json.dumps(results)

__run_exercise()
`;

  const resultJson = await pyodide.runPythonAsync(script);
  return JSON.parse(resultJson);
}

const TESTS_MARKER = /^#\s*=+\s*TESTS\s*=+\s*$/im;
const HIDDEN_SUFFIX = /^(.*?)\s*#\s*hidden\s*$/i;
const FUNCTION_DEF = /^\s*def\s+([A-Za-z_]\w*)\s*\(/m;

// Parses a specialist-authored .py exercise file into { starterCode, functionName, tests, warning }.
// Everything above a "# === TESTS ===" marker is the starter code shown to the
// learner; everything below is one assertion per line, e.g. "add(2, 3) == 5".
// A line ending in "# hidden" is kept out of the learner-facing UI.
export function parseExerciseFile(sourceText) {
  const match = TESTS_MARKER.exec(sourceText);
  if (!match) {
    return { starterCode: sourceText.trimEnd(), functionName: '', tests: [], warning: 'No "# === TESTS ===" marker found — add your test assertions below that line.' };
  }

  const starterCode = sourceText.slice(0, match.index).trimEnd();
  const testsSection = sourceText.slice(match.index + match[0].length);

  const tests = testsSection
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const hiddenMatch = HIDDEN_SUFFIX.exec(line);
      return hiddenMatch
        ? { assertion: hiddenMatch[1].trim(), hidden: true }
        : { assertion: line, hidden: false };
    })
    .filter((test) => test.assertion);

  const functionMatch = FUNCTION_DEF.exec(starterCode);
  const functionName = functionMatch ? functionMatch[1] : '';

  let warning = '';
  if (!functionName) warning = 'No function definition found in the starter code above the marker.';
  else if (!tests.length) warning = 'No test assertions found below the marker.';

  return { starterCode, functionName, tests, warning };
}

const EXERCISE_MARKER = /^#\s*=+\s*EXERCISE\s*:?\s*(.*?)\s*=+\s*$/gim;

// Parses a single .py file that bundles multiple exercises, each introduced by
// a "# === EXERCISE: <instructions> ===" line, into an array of code questions
// ready to drop straight into the module form. Everything between one EXERCISE
// marker and the next is parsed the same way as a single-exercise file
// (parseExerciseFile), so the usual "# === TESTS ===" / "# hidden" rules apply
// inside each block.
export function parseExerciseBundle(sourceText) {
  const markers = [...sourceText.matchAll(EXERCISE_MARKER)];
  if (!markers.length) {
    return { questions: [], warning: 'No "# === EXERCISE: ... ===" markers found — each exercise in the bundle needs one to start it.' };
  }

  const questions = markers.map((marker, index) => {
    const title = marker[1].trim();
    const blockStart = marker.index + marker[0].length;
    const blockEnd = index + 1 < markers.length ? markers[index + 1].index : sourceText.length;
    const block = sourceText.slice(blockStart, blockEnd).trim();
    const parsed = parseExerciseFile(block);
    const warning = parsed.warning || (title ? '' : 'No instructions given after "EXERCISE:" in the marker — add a short prompt for the beneficiary.');
    return {
      type: 'code',
      text: title || `Exercise ${index + 1}`,
      code: { sourceText: block, ...parsed, warning },
    };
  });

  return { questions, warning: '' };
}
