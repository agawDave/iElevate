const { pool } = require('../config/db');
const { verifyAccessToken } = require('../config/jwt');
const { findAccessibleConversation } = require('../lib/moduleConversationAccess');
const { logActivity } = require('../lib/activityLog');

function registerChatHandlers(io) {
  const onlineUsers = new Set();
  // Auth every socket connection using the JWT access token
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = verifyAccessToken(token);
      socket.user = decoded; // { id, uuid, role }
      next();
    } catch (err) {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.user.id}`);
    socket.emit('presence:state', Array.from(onlineUsers));
    onlineUsers.add(socket.user.id);
    io.emit('presence:update', { userId: socket.user.id, online: true });

    socket.on('conversation:join', async (conversationId, acknowledge) => {
      try {
        const conversation = await findAccessibleConversation(conversationId, socket.user.id);
        if (!conversation) {
          acknowledge?.({ success: false, message: 'You do not have access to this module conversation' });
          return;
        }
        await socket.join(`conversation:${conversation.id}`);
        acknowledge?.({ success: true });
      } catch (error) {
        acknowledge?.({ success: false, message: 'Unable to open this module conversation' });
      }
    });

    socket.on('message:send', async (payload = {}) => {
      try {
        const { conversationId, body, attachmentUrl } = payload || {};
        const conversation = await findAccessibleConversation(conversationId, socket.user.id);
        if (!conversation) {
          socket.emit('message:error', { message: 'You do not have access to this module conversation' });
          return;
        }
        if (typeof body !== 'string' || !body.trim() || body.length > 5000) {
          socket.emit('message:error', { message: 'Messages must contain 1 to 5000 characters' });
          return;
        }
        const [result] = await pool.query(
          `INSERT INTO messages (conversation_id, sender_id, body, attachment_url)
           VALUES (?, ?, ?, ?)`,
          [conversation.id, socket.user.id, body.trim(), attachmentUrl || null]
        );

        const message = {
          id: result.insertId,
          conversationId: conversation.id,
          moduleId: conversation.module_id,
          senderId: socket.user.id,
          body: body.trim(),
          attachmentUrl: attachmentUrl || null,
          createdAt: new Date().toISOString(),
        };

        const room = `conversation:${conversation.id}`;
        const roomSockets = await io.in(room).fetchSockets();
        for (const roomSocket of roomSockets) {
          if (!await findAccessibleConversation(conversation.id, roomSocket.user.id)) {
            await roomSocket.leave(room);
          }
        }
        io.to(room).emit('message:new', message);
        const recipientId = String(conversation.user_a_id) === String(socket.user.id)
          ? conversation.user_b_id
          : conversation.user_a_id;
        await logActivity({ userId: socket.user.id, action: 'message_sent', moduleId: conversation.module_id, targetUserId: recipientId });
        const [senders] = await pool.query('SELECT full_name FROM users WHERE id = ?', [socket.user.id]);
        io.to(`user:${recipientId}`).emit('notification:new', {
          type: 'module_message',
          conversationId: conversation.id,
          moduleId: conversation.module_id,
          moduleTitle: conversation.module_title,
          senderName: senders[0]?.full_name || 'A module participant',
          body: message.body,
        });
      } catch (error) {
        socket.emit('message:error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing:start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:start', { userId: socket.user.id });
    });

    socket.on('typing:stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('typing:stop', { userId: socket.user.id });
    });

    socket.on('disconnect', () => {
      onlineUsers.delete(socket.user.id);
      io.emit('presence:update', { userId: socket.user.id, online: false });
    });
  });
}

module.exports = { registerChatHandlers };
