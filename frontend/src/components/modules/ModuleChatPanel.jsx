import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import CertificateUploadDialog from '../certificates/CertificateUploadDialog';
import { openCertificate } from '../../lib/certificates';
import { formatTime } from '../../lib/sessions';
import { avatarTint, initials } from '../../lib/people';
import { useConfirm } from '../../context/ConfirmContext';

const STATUS_LABELS = { ongoing: 'Ongoing', completed: 'Completed' };
const STATUS_STYLES = {
  ongoing: 'bg-brand-50 text-brand-600',
  completed: 'bg-emerald-50 text-emerald-700',
};
const BAND_LABELS = { beginner: 'Beginner', developing: 'Developing', proficient: 'Proficient', strong: 'Strong' };

function Avatar({ name, src, size = 'h-8 w-8' }) {
  return src ? (
    <img src={src} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarTint(name)}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

// The private chat for one topic between a learner and their specialist,
// shown in a side panel from the topic's card on the Modules page.
export default function ModuleChatPanel({ conversation, module, isSpecialist, onOpenMaterials, onChanged, onClose, onViewProfile }) {
  const confirm = useConfirm();
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [joinedId, setJoinedId] = useState(null);
  const [certificateDialog, setCertificateDialog] = useState(null); // 'issue' | 'replace'
  const [reopening, setReopening] = useState(false);
  const [completionNotice, setCompletionNotice] = useState(null);
  const listRef = useRef(null);
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  const conversationId = conversation.id;
  const otherName = conversation.otherUserName || (isSpecialist ? 'your learner' : 'your specialist');
  const firstName = otherName.split(' ')[0];
  const completed = conversation.status === 'completed';
  const reasons = (module.matchReasons || []).filter((reason) => reason !== `Teaches ${module.title}`);

  useEffect(() => {
    let active = true;
    setMessages([]);
    setError('');
    setNotice('');
    setDraft('');
    axiosClient.get(`/messages/conversations/${conversationId}/messages`)
      .then((response) => { if (active) setMessages(response.data.data); })
      .catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Unable to load this conversation.'); });
    axiosClient.patch(`/messages/conversations/${conversationId}/read`)
      .then(() => changedRef.current?.())
      .catch(() => {});
    return () => { active = false; };
  }, [conversationId]);

  // Join the live room (again after a reconnect).
  useEffect(() => {
    setJoinedId(null);
    if (!socket || !connected) return undefined;
    let active = true;
    socket.emit('conversation:join', conversationId, (response) => {
      if (!active) return;
      if (response?.success) setJoinedId(String(conversationId));
      else setError(response?.message || 'Unable to join this conversation.');
    });
    return () => { active = false; };
  }, [socket, connected, conversationId]);

  useEffect(() => {
    if (!socket) return undefined;
    const onMessage = (message) => {
      if (String(message.conversationId) !== String(conversationId)) return;
      setMessages((previous) => (previous.some((item) => String(item.id) === String(message.id)) ? previous : [...previous, message]));
      if (String(message.senderId) !== String(user?.id)) {
        axiosClient.patch(`/messages/conversations/${conversationId}/read`).catch(() => {});
      }
      changedRef.current?.();
    };
    const onError = (socketError) => setError(socketError.message || 'Unable to send message.');
    socket.on('message:new', onMessage);
    socket.on('message:error', onError);
    return () => {
      socket.off('message:new', onMessage);
      socket.off('message:error', onError);
    };
  }, [socket, conversationId, user?.id]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Before issuing a certificate: the learner's test scores, and a reminder
  // if the post-test or some activities aren't done yet.
  useEffect(() => {
    setCompletionNotice(null);
    if (certificateDialog !== 'issue' || !isSpecialist) return undefined;
    let active = true;
    axiosClient.get('/elevate/activities/answers', { params: { moduleId: module.id, beneficiaryId: conversation.beneficiaryId } })
      .then((response) => {
        if (!active) return;
        const { tests, activities } = response.data.data;
        const done = activities.filter((activity) => activity.done).length;
        const missing = [];
        if (tests.questionCount && !tests.post) missing.push(tests.pre ? "hasn't taken the post-test yet" : "hasn't taken the pre-test or the post-test");
        if (done < activities.length) missing.push(`has done ${done} of ${activities.length} activities`);
        const scores = tests.pre && tests.post ? `Pre-test ${tests.pre.score}/${tests.pre.total} → Post-test ${tests.post.score}/${tests.post.total}.` : '';
        if (missing.length) {
          setCompletionNotice({ warn: true, text: `${scores ? `${scores} ` : ''}${firstName} ${missing.join(' and ')}. You can still issue the certificate.` });
        } else if (scores) {
          setCompletionNotice({ warn: false, text: `${scores} All activities done.` });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [certificateDialog, isSpecialist, module.id, conversation.beneficiaryId, firstName]);

  const canSend = Boolean(socket && connected && joinedId === String(conversationId));

  function sendMessage(event) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || !canSend) return;
    setError('');
    socket.emit('message:send', { conversationId, body });
    setDraft('');
  }

  async function submitCertificate(file) {
    const body = new FormData();
    body.append('certificate', file);
    const base = `/modules/${module.id}/learners/${conversation.beneficiaryId}`;
    const response = certificateDialog === 'replace'
      ? await axiosClient.put(`${base}/certificate`, body)
      : await axiosClient.post(`${base}/complete`, body);
    setCertificateDialog(null);
    setError('');
    setNotice(response.data.message);
    changedRef.current?.();
  }

  async function reopenTopic() {
    if (!await confirm({ title: `Reopen ${module.title} for ${otherName}?`, message: 'Their certificate is withdrawn and deleted.', confirmLabel: 'Reopen topic', danger: true })) return;
    setReopening(true);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.delete(`/modules/${module.id}/learners/${conversation.beneficiaryId}/complete`);
      setNotice(response.data.message);
      changedRef.current?.();
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reopen this topic.');
    } finally {
      setReopening(false);
    }
  }

  async function viewCertificate() {
    setError('');
    try {
      await openCertificate(conversation.certificateId);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open the certificate.');
    }
  }

  const button = 'rounded-lg px-3 py-2 text-xs font-semibold';
  const outline = `${button} border border-stone-300 text-slate-700 hover:bg-stone-50`;
  const bookLink = `/sessions?moduleId=${module.id}${isSpecialist ? `&learner=${conversation.beneficiaryId}` : ''}`;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Chat with ${otherName}`}>
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 px-5 py-3.5">
        <Avatar name={otherName} src={conversation.otherUserAvatar} size="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate font-bold text-slate-900">
            {otherName}
            {conversation.status && (
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[conversation.status]}`}>
                {STATUS_LABELS[conversation.status]}
              </span>
            )}
          </p>
          <p className="truncate text-xs text-slate-500">{module.title} · {isSpecialist ? 'your learner' : 'your specialist'}</p>
        </div>
        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          {onViewProfile && <button type="button" onClick={onViewProfile} className={outline}>Profile</button>}
          <button type="button" onClick={onOpenMaterials} className={outline}>Materials</button>
          {!completed && <Link to={bookLink} className={outline}>Book a session</Link>}
          {!isSpecialist && completed && conversation.certificateHasFile && (
            <button type="button" onClick={viewCertificate} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>View your certificate</button>
          )}
          {isSpecialist && !completed && conversation.beneficiaryId && (
            <button type="button" onClick={() => setCertificateDialog('issue')} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>Mark as completed</button>
          )}
          {isSpecialist && completed && (
            <>
              {conversation.certificateHasFile && (
                <button type="button" onClick={viewCertificate} className={`${button} border border-emerald-300 text-emerald-700 hover:bg-emerald-50`}>View certificate</button>
              )}
              <button type="button" onClick={() => setCertificateDialog('replace')} className={outline}>
                {conversation.certificateHasFile ? 'Replace certificate' : 'Upload certificate'}
              </button>
              <button type="button" onClick={reopenTopic} disabled={reopening} className={`${outline} disabled:opacity-50`}>Reopen topic</button>
            </>
          )}
          {onClose && (
            <button type="button" onClick={onClose} aria-label="Close chat" className="rounded-lg px-2 text-xl leading-none text-slate-500 hover:bg-stone-100">×</button>
          )}
        </div>
      </header>

      {isSpecialist && (conversation.learnerNotes || conversation.learnerBand) && (
        <details className="border-b border-slate-200 bg-brand-50/50 px-5 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-brand-600">About {firstName}</summary>
          <div className="mt-2 space-y-1.5 pb-1">
            {conversation.learnerBand && (
              <p className="text-slate-700"><span className="font-semibold">Skill check level for this topic:</span> {BAND_LABELS[conversation.learnerBand] || conversation.learnerBand}</p>
            )}
            {conversation.learnerNotes && (
              <p className="whitespace-pre-line text-slate-700"><span className="font-semibold">They told us:</span> {conversation.learnerNotes}</p>
            )}
          </div>
        </details>
      )}
      {!isSpecialist && reasons.length > 0 && (
        <details className="border-b border-slate-200 bg-emerald-50/60 px-5 py-2 text-sm">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-emerald-700">Why {firstName} is your specialist</summary>
          <ul className="mt-2 list-disc space-y-0.5 pb-1 pl-5 text-slate-700">
            {reasons.map((reason) => <li key={reason}>{reason}</li>)}
          </ul>
        </details>
      )}
      {notice && <p role="status" className="border-b border-emerald-100 bg-emerald-50 px-5 py-2 text-sm text-emerald-800">{notice}</p>}

      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-5 py-4">
        {!messages.length && (
          <p className="py-10 text-center text-sm text-slate-400">No messages yet. Say hello to {firstName}!</p>
        )}
        {messages.map((message) => {
          const senderId = message.sender_id ?? message.senderId;
          const isMine = String(senderId) === String(user?.id);
          // Learners on the left, specialists on the right, for both viewers.
          const fromLearner = isSpecialist ? !isMine : isMine;
          const senderName = isMine ? user?.fullName || 'You' : otherName;
          return (
            <div key={message.id} className={`flex w-full items-end gap-2 ${fromLearner ? 'justify-start' : 'justify-end'}`}>
              {fromLearner && <Avatar name={senderName} src={isMine ? user?.avatarUrl : conversation.otherUserAvatar} />}
              <div className={`flex min-w-0 max-w-[75%] flex-col ${fromLearner ? 'items-start' : 'items-end'}`}>
                <span className="mb-1 px-1 text-[12px] text-slate-500">
                  <span className="font-medium">{senderName}</span> · {formatTime(message.created_at ?? message.createdAt)}
                </span>
                <div className={`whitespace-pre-line break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm ${fromLearner ? 'rounded-bl-md border border-slate-100 bg-white text-slate-800' : 'rounded-br-md bg-brand-600 text-white'}`}>
                  {message.body}
                </div>
              </div>
              {!fromLearner && <Avatar name={senderName} src={isMine ? user?.avatarUrl : conversation.otherUserAvatar} />}
            </div>
          );
        })}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t border-slate-200 p-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={5000}
          disabled={!canSend}
          aria-label={`Message ${otherName}`}
          placeholder={canSend ? `Message ${firstName}…` : 'Connecting to chat…'}
          className="h-10 min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={!draft.trim() || !canSend}
          className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </form>
      {error && <p role="alert" className="px-4 pb-3 text-sm text-red-600">{error}</p>}

      <CertificateUploadDialog
        open={Boolean(certificateDialog)}
        mode={certificateDialog || 'issue'}
        learnerName={otherName}
        moduleTitle={module.title}
        notice={completionNotice}
        onCancel={() => setCertificateDialog(null)}
        onSubmit={submitCertificate}
      />
    </section>
  );
}
