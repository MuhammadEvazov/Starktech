import { createContext, useCallback, useContext, useState } from 'react';

const ToastCtx = createContext(() => {});

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const push = useCallback((text, tone = 'ok') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast--${t.tone}`}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
