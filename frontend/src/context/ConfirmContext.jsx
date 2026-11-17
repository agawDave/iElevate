import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import LineIcon from '../components/ui/LineIcon';

// iELEVATE's own "Are you sure?" box, in place of the browser's confirm()
// (which shows "localhost says…" and can't be styled).
//
//   const confirm = useConfirm();
//   if (!await confirm({ title: 'Remove this material?', message: '…', confirmLabel: 'Remove', danger: true })) return;
//
// danger: the action deletes or undoes something, so the button is red and
// Cancel has the focus. Escape, Cancel or a click outside answers no.

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const confirm = useCallback((options) => new Promise((resolve) => {
    setRequest((previous) => {
      previous?.resolve(false);
      return { confirmLabel: 'OK', cancelLabel: 'Cancel', danger: false, ...options, resolve };
    });
  }), []);
  const answer = useCallback((yes) => {
    setRequest((current) => {
      current?.resolve(yes);
      return null;
    });
  }, []);
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {request && <ConfirmDialog request={request} onAnswer={answer} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  return useContext(ConfirmContext);
}

function ConfirmDialog({ request, onAnswer }) {
  const { title, message, confirmLabel, cancelLabel, danger } = request;
  const cancelButton = useRef(null);
  const confirmButton = useRef(null);

  useEffect(() => {
    const before = document.activeElement;
    (danger ? cancelButton : confirmButton).current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        // Answer no, without also closing a panel underneath.
        event.preventDefault();
        event.stopImmediatePropagation();
        onAnswer(false);
      } else if (event.key === 'Tab') {
        // Keep the focus on the two buttons.
        event.preventDefault();
        (document.activeElement === cancelButton.current ? confirmButton : cancelButton).current?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (before && document.contains(before)) before.focus?.();
    };
  }, [danger, onAnswer]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby={message ? 'confirm-message' : undefined}>
      <button type="button" tabIndex={-1} aria-label={cancelLabel} onClick={() => onAnswer(false)} className="fade-enter absolute inset-0 cursor-default bg-slate-900/40" />
      <div className="pop-enter relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-4">
          {danger && (
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
              <LineIcon name="alert" className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0 pt-0.5">
            <h2 id="confirm-title" className="text-lg font-bold text-slate-900">{title}</h2>
            {message && <p id="confirm-message" className="mt-1 text-sm text-slate-600">{message}</p>}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button ref={cancelButton} type="button" onClick={() => onAnswer(false)} className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
            {cancelLabel}
          </button>
          <button
            ref={confirmButton}
            type="button"
            onClick={() => onAnswer(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${danger ? 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400' : 'bg-accent-500 text-brand-900 hover:bg-accent-550 focus-visible:ring-accent-500'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
