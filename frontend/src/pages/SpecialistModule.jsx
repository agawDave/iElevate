import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import AppLayout from '../components/layout/AppLayout';
import axiosClient from '../api/axiosClient';
import { useAuth } from '../context/AuthContext';
import { parseExerciseFile, parseExerciseBundle } from '../lib/pyodide';

function emptyMcqQuestion() {
  return { type: 'mcq', text: '', options: { a: '', b: '', c: '' }, answer: 'a' };
}

const SAMPLE_EXERCISE = [
  'def add(a, b):',
  '    """Return the sum of a and b."""',
  '    pass',
  '',
  '',
  '# === TESTS ===',
  'add(2, 3) == 5',
  'add(10, -4) == 6  # hidden',
  '',
].join('\n');

function emptyCodeQuestion() {
  return { type: 'code', text: '', code: { sourceText: SAMPLE_EXERCISE, ...parseExerciseFile(SAMPLE_EXERCISE) } };
}

function isBlankMcq(question) {
  return question.type === 'mcq' && !question.text.trim() && !question.options.a.trim() && !question.options.b.trim() && !question.options.c.trim();
}

const emptyForm = {
  title: '',
  description: '',
  topics: '',
  phase: '',
  hours: 1,
  difficulty: 'beginner',
  questions: [],
};

export default function SpecialistModule() {
  const { user } = useAuth();
  const [moduleForm, setModuleForm] = useState(emptyForm);
  const [skillQuery, setSkillQuery] = useState('');
  const [teachingSkills, setTeachingSkills] = useState([]);
  const [skillsLoading, setSkillsLoading] = useState(true);
  const [skillLookupError, setSkillLookupError] = useState('');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [resourceFiles, setResourceFiles] = useState([]);
  const [resourceLinks, setResourceLinks] = useState([]);
  const [resourceLinkDraft, setResourceLinkDraft] = useState({ title: '', url: '' });
  const [submissionMessage, setSubmissionMessage] = useState('');
  const [bundleMessage, setBundleMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    axiosClient.get('/skills/me')
      .then((response) => {
        if (active) {
          setTeachingSkills(response.data.data.filter((skill) => skill.relation_type === 'teaches'));
          setSkillLookupError('');
        }
      })
      .catch((error) => {
        if (active) setSkillLookupError(error.response?.data?.message || 'Unable to load your teaching skills.');
      })
      .finally(() => {
        if (active) setSkillsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const availableSkillResults = teachingSkills.filter((skill) => (
    skill.skill_name.toLowerCase().includes(skillQuery.trim().toLowerCase())
    && !selectedSkills.some((selected) => selected.id === skill.skill_id)
  ));

  if (user?.userType !== 'specialist') return <Navigate to="/modules" replace />;

  async function submitModule(event) {
    event.preventDefault();
    // Drop any untouched "Multiple choice" placeholder question (e.g. the default
    // first lesson, left behind after bulk-importing coding exercises) instead of
    // failing validation on a question the specialist never meant to fill in.
    const cleanedQuestions = moduleForm.questions.filter((question) => !isBlankMcq(question));
    if (!cleanedQuestions.length) {
      setSubmissionMessage('Add at least one lesson before submitting.');
      return;
    }
    if (!teachingSkills.length) {
      setSubmissionMessage('Add a skill you are willing to teach to your profile before creating a module.');
      return;
    }
    if (!selectedSkills.length) {
      setSubmissionMessage('Choose at least one predefined skill for this module.');
      return;
    }
    const topics = moduleForm.topics.split(/\r?\n/).map((topic) => topic.trim()).filter(Boolean);
    if (topics.length > 20 || topics.some((topic) => topic.length > 100)) {
      setSubmissionMessage('Add up to 20 topics, with each topic no longer than 100 characters.');
      return;
    }
    const brokenExercise = cleanedQuestions.find((question) => question.type === 'code' && question.code.warning);
    if (brokenExercise) {
      setSubmissionMessage(`Fix the coding exercise before submitting: ${brokenExercise.code.warning}`);
      return;
    }
    setSaving(true);
    setSubmissionMessage('');
    try {
      const formData = new FormData();
      formData.append('title', moduleForm.title);
      formData.append('description', moduleForm.description);
      formData.append('topics', JSON.stringify(topics));
      formData.append('phase', moduleForm.phase);
      formData.append('hours', moduleForm.hours);
      formData.append('difficulty', moduleForm.difficulty);
      formData.append('skillIds', JSON.stringify(selectedSkills.map((skill) => skill.id)));
      formData.append('questions', JSON.stringify(cleanedQuestions));
      formData.append('resourceLinks', JSON.stringify(resourceLinks));
      resourceFiles.forEach((file) => formData.append('resources', file));
      await axiosClient.post('/modules', formData);
      setModuleForm(emptyForm);
      setSelectedSkills([]);
      setSkillQuery('');
      setResourceFiles([]);
      setResourceLinks([]);
      setResourceLinkDraft({ title: '', url: '' });
      setSubmissionMessage('Module submitted for admin approval.');
    } catch (error) {
      setModuleForm((current) => ({ ...current, questions: cleanedQuestions }));
      setSubmissionMessage(error.response?.data?.message || 'Unable to submit module.');
    } finally {
      setSaving(false);
    }
  }

  function updateQuestions(updater) {
    setSubmissionMessage('');
    setModuleForm((current) => ({ ...current, questions: updater(current.questions) }));
  }

  function setQuestionType(index, type) {
    updateQuestions((questions) => questions.map((question, i) => (
      i === index && question.type !== type ? (type === 'code' ? emptyCodeQuestion() : emptyMcqQuestion()) : question
    )));
  }

  function updateQuestion(index, updates) {
    updateQuestions((questions) => questions.map((question, i) => (i === index ? { ...question, ...updates } : question)));
  }

  function updateOption(index, option, value) {
    updateQuestions((questions) => questions.map((question, i) => (
      i === index ? { ...question, options: { ...question.options, [option]: value } } : question
    )));
  }

  function updateCodeSource(index, sourceText) {
    const parsed = parseExerciseFile(sourceText);
    updateQuestions((questions) => questions.map((question, i) => (
      i === index ? { ...question, code: { sourceText, ...parsed } } : question
    )));
  }

  function handleFileUpload(index, file) {
    const reader = new FileReader();
    reader.onload = () => updateCodeSource(index, String(reader.result));
    reader.readAsText(file);
  }

  function addQuestion(type) {
    updateQuestions((questions) => [...questions, type === 'code' ? emptyCodeQuestion() : emptyMcqQuestion()]);
  }

  function handleBundleUpload(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const { questions: imported, warning } = parseExerciseBundle(String(reader.result));
      if (warning) {
        setBundleMessage(warning);
        return;
      }
      updateQuestions((questions) => [...questions.filter((question) => !isBlankMcq(question)), ...imported]);
      const brokenCount = imported.filter((question) => question.code.warning).length;
      setBundleMessage(
        brokenCount
          ? `Imported ${imported.length} exercises — ${brokenCount} need fixing (see warnings below).`
          : `Imported ${imported.length} exercises from file.`
      );
    };
    reader.readAsText(file);
  }

  function removeQuestion(index) {
    updateQuestions((questions) => questions.filter((_, i) => i !== index));
  }

  function addResourceLink(event) {
    event.preventDefault();
    const title = resourceLinkDraft.title.trim();
    const url = resourceLinkDraft.url.trim();
    try {
      const parsedUrl = new URL(url);
      if (!title || !['https:', 'http:'].includes(parsedUrl.protocol)) {
        setSubmissionMessage('Enter a resource title and a valid HTTP or HTTPS link.');
        return;
      }
    } catch {
      setSubmissionMessage('Enter a valid HTTP or HTTPS link.');
      return;
    }
    if (resourceLinks.length + resourceFiles.length >= 10) {
      setSubmissionMessage('A module can have up to 10 learning resources.');
      return;
    }
    setResourceLinks((current) => [...current, { title, url }]);
    setResourceLinkDraft({ title: '', url: '' });
    setSubmissionMessage('');
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <Link to="/modules" className="text-sm text-slate-500 hover:text-brand-600">← Back to Modules</Link>
        <div className="mt-6 mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-600 mb-1">Specialist workspace</p>
          <h1 className="text-2xl font-extrabold mb-1 tracking-tight">Create a learning module</h1>
          <p className="text-slate-500">Submit your content for admin approval. Beneficiaries can connect with you after it is approved.</p>
        </div>

        <form onSubmit={submitModule} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Module title</label>
            <input required value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} placeholder="e.g. Introduction to PHP" className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
            <textarea required value={moduleForm.description} onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })} placeholder="What will beneficiaries learn?" className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" rows="4" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Topics covered</label>
            <p className="mb-2 text-xs text-slate-500">Enter one topic per line. Topics describe what the module teaches and do not affect skill matching. Up to 20 topics.</p>
            <textarea
              value={moduleForm.topics}
              onChange={(event) => setModuleForm({ ...moduleForm, topics: event.target.value })}
              placeholder={'Variables\nFunctions\nData structures'}
              rows="3"
              maxLength={2020}
              className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Category or phase</label>
              <input value={moduleForm.phase} onChange={(e) => setModuleForm({ ...moduleForm, phase: e.target.value })} placeholder="e.g. Web Development" className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Estimated hours</label>
              <input required type="number" min="1" value={moduleForm.hours} onChange={(e) => setModuleForm({ ...moduleForm, hours: e.target.value })} className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Difficulty level</label>
              <select value={moduleForm.difficulty} onChange={(e) => setModuleForm({ ...moduleForm, difficulty: e.target.value })} className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Skills taught</label>
            <p className="text-xs text-slate-500 mb-2">Choose predefined skills you have marked as willing to teach; the first is the primary matching skill. Use Topics covered below for subtopics such as variables, functions, or data structures.</p>
            {!skillsLoading && !teachingSkills.length && (
              <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Add at least one skill you are willing to teach in your profile before creating a module.
                <Link to="/learning-plan" className="ml-1 font-semibold underline">Go to My Teaching Plan</Link>
              </div>
            )}
            <div className="relative">
              <input
                type="search"
                value={skillQuery}
                onChange={(event) => setSkillQuery(event.target.value)}
                placeholder={skillsLoading ? 'Loading your teaching skills…' : selectedSkills.length >= 5 ? 'Maximum of five skills selected' : 'Search your registered teaching skills…'}
                disabled={skillsLoading || selectedSkills.length >= 5 || !teachingSkills.length}
                className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm disabled:bg-stone-50"
              />
              {availableSkillResults.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-stone-200 bg-white shadow-lg">
                  {availableSkillResults.map((skill) => (
                    <li key={skill.skill_id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSkills((current) => [...current, {
                            id: skill.skill_id,
                            name: skill.skill_name,
                            category: skill.category || '',
                          }]);
                          setSkillQuery('');
                        }}
                        className="w-full px-4 py-2 text-left text-sm hover:bg-stone-100"
                      >
                        {skill.skill_name}{skill.proficiency ? ` · ${skill.proficiency}` : ''}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {skillLookupError && <p role="alert" className="mt-2 text-xs text-red-600">{skillLookupError}</p>}
            {selectedSkills.length > 0 && (
              <ul className="mt-3 space-y-2">
                {selectedSkills.map((skill, index) => (
                  <li key={skill.id} className="flex items-center justify-between gap-3 rounded-lg bg-brand-50 px-3 py-2 text-sm">
                    <span><strong>{index === 0 ? 'Primary skill' : 'Additional skill'}:</strong> {skill.name} <span className="text-slate-500">({skill.category})</span></span>
                    <button
                      type="button"
                      aria-label={`Remove ${skill.name}`}
                      onClick={() => setSelectedSkills((current) => current.filter((item) => item.id !== skill.id))}
                      className="text-red-600 hover:underline"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <section className="rounded-xl border border-stone-200 bg-stone-50 p-4">
            <h2 className="font-semibold text-slate-800">Learning resources</h2>
            <p className="mt-1 text-sm text-slate-500">Attach PDFs, DOCX documents, videos, or helpful external links. Each file can be up to 100 MB. You can add up to 10 resources per module.</p>

            <label className="mt-4 block text-sm font-medium text-slate-700">Upload files (up to 5)</label>
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.mp4,.m4v,.webm,.ogv,.ogg,.mov,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/mp4,video/webm,video/ogg,video/quicktime"
              disabled={resourceFiles.length >= 5 || resourceFiles.length + resourceLinks.length >= 10}
              onChange={(event) => {
                const incoming = Array.from(event.target.files || []);
                const allowed = incoming.slice(0, Math.min(5 - resourceFiles.length, 10 - resourceFiles.length - resourceLinks.length));
                setResourceFiles((current) => [...current, ...allowed]);
                if (allowed.length < incoming.length) {
                  setSubmissionMessage('Only up to 5 files and 10 total resources can be added.');
                } else {
                  setSubmissionMessage('');
                }
                event.target.value = '';
              }}
              className="mt-2 block w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm disabled:bg-stone-100"
            />
            {resourceFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {resourceFiles.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{file.name} <span className="text-xs text-slate-500">({(file.size / (1024 * 1024)).toFixed(1)} MB)</span></span>
                    <button type="button" onClick={() => setResourceFiles((current) => current.filter((_, fileIndex) => fileIndex !== index))} className="shrink-0 text-xs text-red-600 hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
              <input
                value={resourceLinkDraft.title}
                onChange={(event) => setResourceLinkDraft((current) => ({ ...current, title: event.target.value }))}
                placeholder="Link title"
                maxLength={190}
                aria-label="External resource title"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <input
                type="url"
                value={resourceLinkDraft.url}
                onChange={(event) => setResourceLinkDraft((current) => ({ ...current, url: event.target.value }))}
                placeholder="https://example.com/learning-resource"
                aria-label="External resource URL"
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addResourceLink}
                disabled={resourceFiles.length + resourceLinks.length >= 10}
                className="rounded-lg border border-brand-600 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50"
              >
                Add link
              </button>
            </div>
            {resourceLinks.length > 0 && (
              <ul className="mt-3 space-y-2">
                {resourceLinks.map((resource, index) => (
                  <li key={`${resource.url}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-sm">
                    <span className="min-w-0 truncate text-slate-700">{resource.title} <span className="text-xs text-slate-500">· {resource.url}</span></span>
                    <button type="button" onClick={() => setResourceLinks((current) => current.filter((_, linkIndex) => linkIndex !== index))} className="shrink-0 text-xs text-red-600 hover:underline">Remove</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="border-t border-stone-200 pt-5">
            <h2 className="font-semibold mb-1">Lessons</h2>
            <p className="text-sm text-slate-500 mb-4">Add a multiple-choice question, or a coding exercise the beneficiary must solve in-browser to advance — like SoloLearn.</p>

            <div className="rounded-xl border border-dashed border-brand-300 bg-brand-50/50 p-4 mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Bulk-import exercises from one file</label>
              <p className="text-xs text-slate-500 mb-2">
                Upload a single .py file that bundles several exercises, each starting with a <code>{'# === EXERCISE: <instructions> ==='}</code> line. Every exercise below that marker (up to the next one) is parsed the same way as a single exercise file and added as its own lesson.
              </p>
              <input
                type="file"
                accept=".py,text/x-python,text/plain"
                onChange={(e) => e.target.files[0] && handleBundleUpload(e.target.files[0])}
                className="block text-sm"
              />
              {bundleMessage && <p className="text-xs text-slate-600 mt-2">{bundleMessage}</p>}
            </div>

            {!moduleForm.questions.length && (
              <p className="text-sm text-slate-400 mb-6">No lessons yet — add a question below or bulk-import a file above.</p>
            )}

            <div className="space-y-6">
              {moduleForm.questions.map((question, index) => (
                <div key={index} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="inline-flex rounded-full border border-stone-300 p-1 text-xs font-medium">
                      <button type="button" onClick={() => setQuestionType(index, 'mcq')} className={`rounded-full px-3 py-1 ${question.type === 'mcq' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Multiple choice</button>
                      <button type="button" onClick={() => setQuestionType(index, 'code')} className={`rounded-full px-3 py-1 ${question.type === 'code' ? 'bg-brand-600 text-white' : 'text-slate-600'}`}>Coding exercise</button>
                    </div>
                    <button type="button" onClick={() => removeQuestion(index)} className="text-xs text-red-600 hover:underline">Remove</button>
                  </div>

                  {question.type === 'mcq' ? (
                    <>
                      <input required value={question.text} onChange={(e) => updateQuestion(index, { text: e.target.value })} placeholder="Question" className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm mb-3" />
                      <div className="grid sm:grid-cols-3 gap-3">
                        {['a', 'b', 'c'].map((option) => (
                          <input key={option} required value={question.options[option]} onChange={(e) => updateOption(index, option, e.target.value)} placeholder={`Option ${option.toUpperCase()}`} className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm" />
                        ))}
                      </div>
                      <label className="block text-sm text-slate-600 mt-4">Correct answer
                        <select value={question.answer} onChange={(e) => updateQuestion(index, { answer: e.target.value })} className="ml-2 rounded-lg border border-stone-300 px-3 py-2">
                          <option value="a">A</option><option value="b">B</option><option value="c">C</option>
                        </select>
                      </label>
                    </>
                  ) : (
                    <>
                      <textarea required value={question.text} onChange={(e) => updateQuestion(index, { text: e.target.value })} placeholder="Instructions, e.g. Write a function that adds two numbers." className="w-full rounded-lg border border-stone-300 px-3 py-2.5 text-sm mb-3" rows="2" />

                      <label className="block text-xs font-medium text-slate-600 mb-1">Attach your exercise (.py)</label>
                      <p className="text-xs text-slate-400 mb-2">
                        A single Python file: the starter code the beneficiary sees, then a <code>{'# === TESTS ==='}</code> line, then one assertion per line (e.g. <code>add(2, 3) == 5</code>). Add <code>{'# hidden'}</code> at the end of a line to keep that test hidden while they solve it.
                      </p>
                      <input
                        type="file"
                        accept=".py,text/x-python,text/plain"
                        onChange={(e) => e.target.files[0] && handleFileUpload(index, e.target.files[0])}
                        className="block text-sm mb-3"
                      />
                      <textarea
                        required
                        value={question.code.sourceText}
                        onChange={(e) => updateCodeSource(index, e.target.value)}
                        className="w-full rounded-lg border border-stone-300 bg-slate-900 text-slate-100 px-3 py-2.5 text-sm font-mono mb-3"
                        rows="10"
                        spellCheck={false}
                      />

                      {question.code.warning ? (
                        <p className="text-xs text-amber-600 mb-2">{question.code.warning}</p>
                      ) : (
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-800 mb-2">
                          <p>Detected function: <code className="font-mono">{question.code.functionName}(...)</code></p>
                          <ul className="mt-1.5 space-y-0.5">
                            {question.code.tests.map((test, testIndex) => (
                              <li key={testIndex} className="font-mono">
                                {test.hidden ? '🔒 ' : ''}{test.assertion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-4">
              <button type="button" onClick={() => addQuestion('mcq')} className="text-sm text-brand-600 hover:underline">+ Add multiple-choice question</button>
              <button type="button" onClick={() => addQuestion('code')} className="text-sm text-brand-600 hover:underline">+ Add coding exercise</button>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-accent-500 hover:bg-accent-550 px-5 py-2.5 text-sm font-semibold text-brand-900 disabled:opacity-50">{saving ? 'Submitting...' : 'Submit for approval'}</button>
            <Link to="/modules" className="text-sm text-slate-500 hover:text-slate-800">Cancel</Link>
          </div>
          {submissionMessage && <p className="text-sm text-slate-600">{submissionMessage}</p>}
        </form>
      </div>
    </AppLayout>
  );
}
