import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { formatTime } from '../../lib/sessions';
import { Avatar } from '../modules/ModuleChatPanel';
import useConversation from './useConversation';

// A chat outside any topic: the admin with one beneficiary or specialist. The
// admin opens it with MessageButton; the other person replies from the bell.
export default function DirectChatPanel({ conversation, subtitle, onClose, onChanged }) {
  const { user } = useAuth();
  const { messages, error, canSend, send, listRef } = useConversation(conversation.id, onChanged);
  const [draft, setDraft] = useState('');
  const name = conversation.otherUserName;
  const firstName = name.split(' ')[0];

  // Esc closes only this chat, not the details panel under it (capture runs first).
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  function submit(event) {
    event.preventDefault();
    if (send(draft.trim())) setDraft('');
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Chat with ${name}`}>
      <button type="button" tabIndex={-1} aria-label="Close chat" onClick={onClose} className="absolute inset-0 cursor-default bg-slate-900/30" />
      <section className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-3.5">
          <Avatar name={name} src={conversation.otherUserAvatar} size="h-10 w-10" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{subtitle}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close chat" className="rounded-lg px-2 text-xl leading-none text-slate-500 hover:bg-stone-100">×</button>
        </header>

        <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/70 px-5 py-4">
          {!messages.length && <p className="py-10 text-center text-sm text-slate-400">No messages yet. Write to {firstName} below.</p>}
          {messages.map((message) => {
            const isMine = String(message.sender_id ?? message.senderId) === String(user?.id);
            return (
              <div key={message.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                <span className="mb-1 px-1 text-[12px] text-slate-500">
                  <span className="font-medium">{isMine ? 'You' : name}</span> · {formatTime(message.created_at ?? message.createdAt)}
                </span>
                <div className={`max-w-[85%] whitespace-pre-line break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm ${isMine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-slate-100 bg-white text-slate-800'}`}>
                  {message.body}
                </div>
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} className="flex items-center gap-2 border-t border-slate-200 p-3">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={5000}
            disabled={!canSend}
            autoFocus
            aria-label={`Message ${name}`}
            placeholder={canSend ? `Message ${firstName}…` : 'Connecting to chat…'}
            className="h-10 min-w-0 flex-1 rounded-full bg-slate-100 px-4 text-sm outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button type="submit" disabled={!draft.trim() || !canSend} className="rounded-lg bg-accent-500 px-5 py-2.5 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:cursor-not-allowed disabled:opacity-50">
            Send
          </button>
        </form>
        {error && <p role="alert" className="px-4 pb-3 text-sm text-red-600">{error}</p>}
      </section>
    </div>,
    document.body,
  );
}

// Admin: opens (or starts) the chat with one beneficiary or specialist.
export function MessageButton({ userId, onOpen }) {
  const [error, setError] = useState('');
  const [opening, setOpening] = useState(false);

  async function open() {
    setOpening(true);
    setError('');
    try {
      const response = await axiosClient.post(`/admin/users/${userId}/chat`);
      onOpen(response.data.data);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to open the chat.');
    } finally {
      setOpening(false);
    }
  }

  return (
    <>
      <button type="button" onClick={open} disabled={opening} className="rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550 disabled:opacity-50">
        {opening ? 'Opening…' : 'Message'}
      </button>
      {error && <p role="alert" className="w-full text-sm text-red-600">{error}</p>}
    </>
  );
}
