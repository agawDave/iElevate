// Red dot on the corner of a chat button: someone is waiting for the user's reply
// there. It goes away when they reply (not when they just open the chat).
// The button needs `relative`.
export default function ReplyDot({ label = 'waiting for your reply' }) {
  return (
    <>
      <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-white" title={label} aria-hidden="true" />
      <span className="sr-only"> ({label})</span>
    </>
  );
}
