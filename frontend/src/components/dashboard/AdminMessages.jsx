import { useCallback, useEffect, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import DirectChatPanel from '../chat/DirectChatPanel';
import { waitedFor } from '../../lib/sessions';
import ReplyDot from '../ui/ReplyDot';

// The admin's chat with this beneficiary or specialist, on their dashboard
// (only once the admin has written). Reply opens the chat.
export default function AdminMessages() {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [chats, setChats] = useState([]);
  const [open, setOpen] = useState(null);

  const load = useCallback(() => {
    axiosClient.get('/messages/inbox').then((response) => setChats(response.data.data.adminChats || [])).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!socket) return undefined;
    const refresh = (notification) => { if (notification?.type === 'admin_message') load(); };
    socket.on('notification:new', refresh);
    return () => socket.off('notification:new', refresh);
  }, [socket, load]);

  if (!chats.length) return null;
  return (
    <>
      {open && <DirectChatPanel conversation={open} subtitle="iELEVATE administrator" onClose={() => { setOpen(null); load(); }} />}
      {chats.map((chat) => {
        const waiting = String(chat.lastSenderId) !== String(user?.id);
        return (
          <section key={chat.id} aria-label="Message from the admin" className={`mb-6 flex flex-wrap items-center gap-3 rounded-2xl border px-5 py-4 ${waiting ? 'border-accent-200 bg-accent-50' : 'border-stone-200 bg-white'}`}>
            <div className="min-w-0 flex-1 basis-64">
              <p className="text-sm font-semibold text-slate-900">
                Message from the iELEVATE admin
                {waiting && <span className="ml-2 rounded-full bg-accent-500 px-2 py-0.5 text-[11px] font-bold text-brand-900">Waiting for your reply</span>}
              </p>
              <p className="mt-0.5 line-clamp-2 break-words text-sm italic text-slate-700">&ldquo;{chat.lastMessage}&rdquo;</p>
              <p className="mt-0.5 text-xs text-slate-500">{waiting ? chat.otherUserName : 'You'} · {waitedFor(String(chat.lastMessageAt).replace(' ', 'T'))} ago</p>
            </div>
            <button type="button" onClick={() => setOpen(chat)} className={waiting ? 'relative shrink-0 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-brand-900 hover:bg-accent-550' : 'shrink-0 rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50'}>
              {waiting ? 'Reply' : 'Open chat'}
              {waiting && <ReplyDot label="The admin is waiting for your reply" />}
            </button>
          </section>
        );
      })}
    </>
  );
}
