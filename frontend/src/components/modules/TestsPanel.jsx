import { useEffect, useRef, useState } from 'react';
import { DetailPanel } from '../admin/Directory';
import TestQuestionsEditor, { useTestQuestions } from './TestQuestionsEditor';
import PasteQuestions from './PasteQuestions';

const MAX_TEST_QUESTIONS = 30;
const KINDS = [{ kind: 'pre', label: 'Pre-test' }, { kind: 'post', label: 'Post-test' }];

// A specialist writes a topic's pre-test and post-test, each with its own
// questions: one at a time, or many at once with Paste questions or a Word file.
export default function TestsPanel({ topicId, topics = [], onClose, onChanged }) {
  const [currentId, setCurrentId] = useState(topicId);
  const [kind, setKind] = useState('pre');
  const [pasting, setPasting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [notice, setNotice] = useState('');
  const top = useRef(null);
  const { test, reload } = useTestQuestions(currentId);
  const topicTitle = topics.find((topic) => String(topic.id) === String(currentId))?.title || 'this topic';
  const questions = test?.[kind] || [];
  const kindLabel = KINDS.find((item) => item.kind === kind).label;

  useEffect(() => { setCurrentId(topicId); }, [topicId]);
  // Another topic or test: back to its questions, with an empty paste box.
  useEffect(() => {
    setPasting(false);
    setPasteText('');
    setNotice('');
  }, [currentId, kind]);
  // Each screen starts at the top of the panel.
  useEffect(() => { top.current?.scrollIntoView({ block: 'start' }); }, [pasting]);

  async function pasted({ added, left }) {
    const stillThere = left ? ` ${left === 1 ? 'The one that needs a fix is' : `The ${left} that need a fix are`} still in the paste box.` : '';
    await reload();
    setNotice(`${added} question${added === 1 ? '' : 's'} added to your ${kindLabel.toLowerCase()}.${stillThere}`);
    setPasting(false);
    onChanged?.();
  }

  return (
    <DetailPanel open={Boolean(topicId)} title={`Pre-test & post-test · ${topicTitle}`} onClose={onClose}>
      <div ref={top} className="scroll-mt-4" />
      {topics.length > 1 && !pasting && (
        <label className="mb-4 block text-sm font-medium text-slate-700">
          Topic
          <select value={currentId || ''} onChange={(event) => setCurrentId(event.target.value)} className="mt-1 block w-full rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200">
            {topics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
          </select>
        </label>
      )}
      {!pasting && (
        <div role="tablist" aria-label="Test" className="mb-4 flex gap-1 rounded-lg bg-stone-100 p-1">
          {KINDS.map((item) => (
            <button
              key={item.kind}
              type="button"
              role="tab"
              aria-selected={kind === item.kind}
              onClick={() => setKind(item.kind)}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition ${kind === item.kind ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              {item.label} ({(test?.[item.kind] || []).length})
            </button>
          ))}
        </div>
      )}
      {pasting ? (
        <PasteQuestions
          moduleId={currentId}
          kind={kind}
          text={pasteText}
          onTextChange={setPasteText}
          savedPrompts={questions.map((question) => question.prompt)}
          room={MAX_TEST_QUESTIONS - questions.length}
          takenBy={test ? test.taken[kind] : 0}
          onBack={() => setPasting(false)}
          onAdded={pasted}
        />
      ) : (
        <TestQuestionsEditor
          key={`${currentId}-${kind}`}
          moduleId={currentId}
          kind={kind}
          topicTitle={topicTitle}
          test={test}
          initialNotice={notice}
          onChanged={async () => { await reload(); onChanged?.(); }}
          onPaste={(text) => { setNotice(''); if (typeof text === 'string') setPasteText(text); setPasting(true); }}
        />
      )}
    </DetailPanel>
  );
}
