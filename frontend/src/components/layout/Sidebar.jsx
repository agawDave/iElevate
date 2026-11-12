import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import axiosClient from '../../api/axiosClient';
import { useSocket } from '../../context/SocketContext';
import elevateLogo from '../../assets/elevate-logo.png';
import LineIcon from '../ui/LineIcon';

const icons = {
  dashboard: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3 3h6v6H3V3zm8 0h6v6h-6V3zM3 11h6v6H3v-6zm8 0h6v6h-6v-6z" />
    </svg>
  ),
  match: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M6 3a1 1 0 011 1v8.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 111.414-1.414L5 12.586V4a1 1 0 011-1zm8 14a1 1 0 01-1-1V7.414l-1.293 1.293a1 1 0 11-1.414-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 11-1.414 1.414L15 7.414V16a1 1 0 01-1 1z" />
    </svg>
  ),
  modules: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3 4a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2V4zm10 0a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 01-2 2h-2a2 2 0 01-2-2V4zM3 13a2 2 0 012-2h3a2 2 0 012 2v3a2 2 0 01-2 2H5a2 2 0 01-2-2v-3zm10 0a2 2 0 012-2h2a2 2 0 012 2v3a2 2 0 01-2 2h-2a2 2 0 01-2-2v-3z" />
    </svg>
  ),
  people: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zm7 0a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1 16a6 6 0 0112 0v1H1v-1zm13.5 1H19v-.5a4.5 4.5 0 00-6.27-4.14A7.47 7.47 0 0114.5 16.5v.5z" />
    </svg>
  ),
  specialists: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2L1 6.5l9 4.5 7-3.5V13h2V6.5L10 2zM4 10.6V14c0 1.66 2.69 3 6 3s6-1.34 6-3v-3.4l-6 3-6-3z" />
    </svg>
  ),
  approval: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.4L10.6 2H6zm6.7 7.7a1 1 0 00-1.4-1.4L9 10.6l-.8-.8a1 1 0 00-1.4 1.4l1.5 1.5a1 1 0 001.4 0l3-3z" clipRule="evenodd" />
    </svg>
  ),
  messages: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.84 8.84 0 01-3.08-.55L3 17l1.07-3.2A6.6 6.6 0 012 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
    </svg>
  ),
  plan: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2h-1.2a2 2 0 00-1.8-1H9a2 2 0 00-1.8 1H6zm1.3 8.3a1 1 0 011.4 0l.8.8 2.3-2.3a1 1 0 111.4 1.4l-3 3a1 1 0 01-1.4 0l-1.5-1.5a1 1 0 010-1.4z"
        clipRule="evenodd"
      />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zM4 8h12v8H4V8z"
        clipRule="evenodd"
      />
    </svg>
  ),
  credentials: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 2l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 14.27l-4.77 2.44.91-5.32L2.27 7.62l5.34-.78L10 2z" />
    </svg>
  ),
  profile: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M10 10a4 4 0 100-8 4 4 0 000 8zm-6 8a6 6 0 0112 0H4z" />
    </svg>
  ),
  reports: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path d="M3 17h14v1H3v-1zM4 10h3v6H4v-6zm4.5-4h3v10h-3V6zM13 2h3v14h-3V2z" />
    </svg>
  ),
  activity: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M4 3a1 1 0 011-1h10a1 1 0 011 1v14a1 1 0 01-1 1H5a1 1 0 01-1-1V3zm3 2.5a.75.75 0 000 1.5h6a.75.75 0 000-1.5H7zm0 3.5a.75.75 0 000 1.5h6a.75.75 0 000-1.5H7zm0 3.5a.75.75 0 000 1.5h4a.75.75 0 000-1.5H7z" clipRule="evenodd" />
    </svg>
  ),
  admin: (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path
        fillRule="evenodd"
        d="M10 1l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V4l7-3zm0 4a2 2 0 100 4 2 2 0 000-4zm0 6c-1.7 0-3.2.6-4.2 1.6a5.9 5.9 0 008.4 0C13.2 11.6 11.7 11 10 11z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

// Most-used first. `apart` pages (settings, used now and then) sit at the
// bottom of the menu, after a thin line.
const links = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/modules', label: 'Modules', icon: 'modules' },
  { to: '/sessions', label: 'Sessions', icon: 'sessions' },
  { to: '/portfolio', label: 'My Portfolio', icon: 'credentials', beneficiaryOnly: true },
  { to: '/learning-plan', label: 'My Learning Plan', specialistLabel: 'My Teaching Plan', icon: 'plan' },
  { to: '/profile', label: 'Profile', icon: 'profile', apart: true },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/admin/beneficiaries', label: 'Beneficiaries', icon: 'people' },
  { to: '/admin/specialists', label: 'Specialists', icon: 'specialists' },
  { to: '/admin/modules', label: 'Module approval', icon: 'approval', badge: 'pending_modules', badgeTitle: 'waiting for approval' },
  { to: '/admin/reports', label: 'Reports', icon: 'reports' },
  { to: '/admin/activity', label: 'Activity log', icon: 'activity' },
  { to: '/admin/users', label: 'Manage users', icon: 'admin', apart: true },
];

// "You are here" in orange: a bar on the left of the active item, and its icon.
const ACTIVE_LINK = 'relative bg-brand-50 text-brand-600 font-semibold before:absolute before:left-0 before:top-[22%] before:bottom-[22%] before:w-1 before:rounded-full before:bg-accent-500 [&>svg]:text-accent-500';
const linkClass = ({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-[15px] transition ${
  isActive ? ACTIVE_LINK : 'text-slate-700 hover:bg-stone-50 hover:text-slate-900'
}`;

const USER_TYPE_LABEL = {
  specialist: 'Specialist',
  beneficiary: 'Beneficiary',
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingSessions, setPendingSessions] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [incomingMatches, setIncomingMatches] = useState(0);
  const [messageNotification, setMessageNotification] = useState(null);
  // Chats where the other person wrote last: they stay in the sidebar until the user replies.
  const [awaitingReply, setAwaitingReply] = useState([]);
  const [adminCounts, setAdminCounts] = useState(null);

  function loadNotifications() {
    if (user?.role === 'admin') {
      axiosClient.get('/admin/nav-counts').then((response) => setAdminCounts(response.data.data)).catch(() => {});
      return;
    }
    Promise.all([
      axiosClient.get('/sessions/modules/me'),
      axiosClient.get('/messages/inbox'),
      // Specialists: applications waiting for them to accept (Incoming).
      user?.userType === 'specialist' ? axiosClient.get('/elevate/applications/incoming') : Promise.resolve(null),
    ]).then(([sessions, messages, applications]) => {
      const conversations = messages.data.data.conversations;
      setPendingSessions(sessions.data.data.filter((item) => item.status === 'pending' && !item.scheduledByMe).length);
      setUnreadMessages(conversations.reduce((total, item) => total + item.unreadCount, 0));
      setIncomingMatches(applications?.data.data.length || 0);
      setAwaitingReply(conversations
        .filter((item) => item.status === 'ongoing' && item.lastSenderId && String(item.lastSenderId) !== String(user.id))
        .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt)));
    }).catch(() => {});
  }

  useEffect(() => {
    if (!user) return undefined;
    loadNotifications();
    const interval = window.setInterval(loadNotifications, user.role === 'admin' ? 30000 : 10000);
    // Admin pages announce changes (e.g. a module approved) so badges update at once.
    window.addEventListener('admin-counts-changed', loadNotifications);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('admin-counts-changed', loadNotifications);
    };
  }, [user]);

  useEffect(() => {
    if (!socket) return undefined;
    const handleNotification = (notification) => {
      // Messages show in the sidebar until the user replies (see awaitingReply), not as a pop-up.
      if (notification.type === 'module_message') {
        loadNotifications();
        return;
      }
      if (!['module_session', 'module_application', 'module_activity'].includes(notification.type)) return;
      setMessageNotification(notification);
      loadNotifications();
    };
    // The user replied in a chat: refresh so its reminder goes away at once.
    const handleMessage = (message) => {
      if (String(message.senderId) === String(user?.id)) loadNotifications();
    };
    socket.on('notification:new', handleNotification);
    socket.on('message:new', handleMessage);
    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('message:new', handleMessage);
    };
  }, [socket, user]);

  useEffect(() => {
    if (!messageNotification) return undefined;
    const timeout = window.setTimeout(() => setMessageNotification(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [messageNotification]);

  const initials = user?.fullName
    ?.split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  // Not the chat that's open right now on the Modules page.
  const openChatId = location.pathname === '/modules' ? new URLSearchParams(location.search).get('chat') : null;
  const waitingChats = awaitingReply.filter((item) => String(item.id) !== String(openChatId));
  const latestWaiting = waitingChats[0];

  const isAdmin = user?.role === 'admin';
  const isSpecialist = user?.userType === 'specialist';
  const heading = isAdmin ? 'Administration' : isSpecialist ? 'Teaching' : 'Learning';
  const shownLinks = isAdmin ? ADMIN_LINKS : links.filter((l) => !l.beneficiaryOnly || !isSpecialist);

  // The count beside a menu item: unread messages or new applications on
  // Modules, sessions to answer, modules waiting for an admin's approval.
  function badgeFor(l) {
    if (l.to === '/modules' && unreadMessages > 0) return <span title={`${unreadMessages} unread`} className="min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">{unreadMessages}</span>;
    if (l.to === '/modules' && incomingMatches > 0) return <span title={`${incomingMatches} new`} className="h-5 px-1.5 rounded-full bg-accent-500 text-brand-900 text-[10px] font-bold flex items-center justify-center">{incomingMatches} new</span>;
    if (l.to === '/sessions' && pendingSessions > 0) return <span className="min-w-5 h-5 px-1 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center">{pendingSessions}</span>;
    if (l.badge && adminCounts?.[l.badge] > 0) {
      return (
        <span title={`${adminCounts[l.badge]} ${l.badgeTitle}`} className="min-w-5 h-5 px-1.5 rounded-full bg-accent-500 text-brand-900 text-[10px] font-bold flex items-center justify-center">
          {adminCounts[l.badge]}
        </span>
      );
    }
    return null;
  }

  const renderLink = (l) => (
    <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
      {icons[l.icon]}
      <span className="flex-1">{isSpecialist && l.specialistLabel ? l.specialistLabel : l.label}</span>
      {badgeFor(l)}
    </NavLink>
  );

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-stone-200 flex flex-col h-screen sticky top-0 print:hidden">
      {/* Rendered on <body>: inside the sticky sidebar it would sit under the page's headers. */}
      {messageNotification && createPortal(
        <button
          type="button"
          onClick={() => {
            const { type, kind, conversationId } = messageNotification;
            if (type === 'module_session') navigate('/sessions');
            else if (type === 'module_application') navigate(kind === 'accepted' ? `/modules?tab=ongoing&chat=${conversationId}` : kind === 'new' ? '/modules?tab=incoming' : '/modules');
            else if (type === 'module_activity') navigate(kind === 'reviewed' ? `/modules/${messageNotification.moduleId}` : '/modules?tab=ongoing');
            setMessageNotification(null);
          }}
          className="pop-enter fixed right-5 top-5 z-50 flex w-[min(24rem,calc(100vw-2rem))] items-start gap-3 rounded-xl bg-slate-900 px-4 py-3 text-left text-white shadow-xl"
          aria-live="polite"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-500 text-brand-900" aria-hidden="true">
            <LineIcon name={{ module_session: 'calendar', module_application: 'clipboard', module_activity: 'pencil' }[messageNotification.type] || 'clipboard'} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">{messageNotification.senderName} · {messageNotification.moduleTitle}</span>
            <span className="mt-1 block truncate text-sm text-slate-200">{messageNotification.body}</span>
          </span>
          <span className="text-xs text-slate-400">Open</span>
        </button>,
        document.body,
      )}
      <div className="px-5 pb-5 pt-6">
        <img src={elevateLogo} alt="iELEVATE" className="h-12 w-auto" />
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">{heading}</p>
        {shownLinks.filter((l) => !l.apart).map(renderLink)}
        <div className="!mt-3 space-y-1 border-t border-stone-100 pt-3">
          {shownLinks.filter((l) => l.apart).map(renderLink)}
        </div>
      </nav>

      {latestWaiting && (
        <section className="mx-3 mb-3 rounded-xl border border-accent-500/40 bg-accent-50 p-3" role="status" aria-live="polite" aria-label="Waiting for your reply">
          <p className="text-[12px] font-bold uppercase tracking-wider text-accent-600">Waiting for your reply</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">{latestWaiting.otherUserName}</p>
          <p className="truncate text-xs text-slate-500">{latestWaiting.moduleTitle}</p>
          {latestWaiting.lastMessage && <p className="mt-1 line-clamp-2 break-words text-xs italic text-slate-700">&ldquo;{latestWaiting.lastMessage}&rdquo;</p>}
          <button
            type="button"
            onClick={() => navigate(`/modules?tab=ongoing&chat=${latestWaiting.id}`)}
            className="mt-2 w-full rounded-lg bg-accent-500 px-3 py-1.5 text-xs font-bold text-brand-900 transition hover:bg-accent-550"
          >
            Reply
          </button>
          {waitingChats.length > 1 && (
            <button type="button" onClick={() => navigate('/modules?tab=ongoing')} className="mt-1.5 w-full text-xs font-medium text-brand-600 hover:underline">
              + {waitingChats.length - 1} more waiting
            </button>
          )}
        </section>
      )}

      <div className="px-4 py-4 border-t border-stone-200 flex items-center gap-3">
        {user?.avatarUrl ? (
          <img src={user.avatarUrl} alt={`${user.fullName}'s profile`} className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-brand-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{user?.fullName}</p>
          <p className="text-xs text-slate-500">{user?.role === 'admin' ? 'Administrator' : USER_TYPE_LABEL[user?.userType] || 'Member'}</p>
        </div>
        <button
          onClick={() => {
            logout();
            navigate('/login');
          }}
          title="Log out"
          className="text-slate-400 hover:text-red-500 shrink-0"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path
              fillRule="evenodd"
              d="M3 3a1 1 0 011-1h6a1 1 0 110 2H5v12h5a1 1 0 110 2H4a1 1 0 01-1-1V3zm10.293 3.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L14.586 11H8a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
