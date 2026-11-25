import { useEffect, useRef, useState } from 'react';
import axiosClient from '../../api/axiosClient';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

// One conversation, live: loads its messages, marks them read, joins its socket
// room and sends. onChanged runs after reading and on each new message.
export default function useConversation(conversationId, onChanged) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState('');
  const [joinedId, setJoinedId] = useState(null);
  const listRef = useRef(null);
  const changedRef = useRef(onChanged);
  changedRef.current = onChanged;

  useEffect(() => {
    let active = true;
    setMessages([]);
    setError('');
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

  const canSend = Boolean(socket && connected && joinedId === String(conversationId));

  // Returns whether it was sent, so the caller can clear its draft.
  function send(body) {
    if (!body || !canSend) return false;
    setError('');
    socket.emit('message:send', { conversationId, body });
    return true;
  }

  return { messages, error, setError, canSend, send, listRef };
}
