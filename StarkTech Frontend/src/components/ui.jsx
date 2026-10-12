import { useEffect, useId, useRef, useState } from 'react';
import { assetUrl } from '../api/client.js';
import { ORDER_STATUS, PAYMENT_STATUS } from '../lib/format.js';

export function Spinner({ label = 'Загрузка…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorBox({ error, onRetry }) {
  if (!error) return null;
  const messages = error.messages || [String(error.message || error)];
  return (
    <div className="error-box" role="alert">
      {messages.map((m, i) => (
        <p key={i}>{m}</p>
      ))}
      {onRetry && (
        <button type="button" className="btn btn--small btn--ghost" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__text">{children}</p>}
      {action}
    </div>
  );
}

/** Состояния загрузки/ошибки/пусто для useAsync-результата. */
export function Async({ state, children, empty }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error) return <ErrorBox error={state.error} onRetry={state.reload} />;
  if (empty && isEmpty(state.data)) return empty;
  return children(state.data);
}

const isEmpty = (d) => !d || (Array.isArray(d) && !d.length) || (Array.isArray(d?.items) && !d.items.length);

export function Pagination({ page, totalPages, onChange }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Страницы">
      <button type="button" className="btn btn--small btn--ghost" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        Назад
      </button>
      <span>
        {page} из {totalPages}
      </span>
      <button
        type="button"
        className="btn btn--small btn--ghost"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Дальше
      </button>
    </nav>
  );
}

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal__panel ${wide ? 'modal__panel--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal__head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const child = typeof children === 'function' ? children(id) : children;
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {child}
      {hint && !error && <p className="field__hint">{hint}</p>}
      {error && <p className="field__error">{error}</p>}
    </div>
  );
}

export function Input({ label, hint, error, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className="input" {...props} />}
    </Field>
  );
}

export function Textarea({ label, hint, className, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <textarea id={id} className="input input--area" rows={3} {...props} />}
    </Field>
  );
}

export function Select({ label, hint, options, placeholder, className, ...props }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className="input" {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, ...props }) {
  return (
    <label className="checkbox">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} {...props} />
      <span>{label}</span>
    </label>
  );
}

const STATUS_TONE = {
  New: 'blue',
  Confirmed: 'blue',
  InProduction: 'yellow',
  ReadyForDelivery: 'yellow',
  Delivered: 'green',
  Cancelled: 'red',
  Pending: 'grey',
  Paid: 'green',
  Failed: 'red',
  Refunded: 'grey',
};

export function Badge({ tone = 'grey', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export const OrderStatusBadge = ({ status }) => <Badge tone={STATUS_TONE[status]}>{ORDER_STATUS[status] || status}</Badge>;
export const PaymentStatusBadge = ({ status }) => (
  <Badge tone={STATUS_TONE[status]}>{PAYMENT_STATUS[status] || status}</Badge>
);

export function Stars({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <span className={`stars stars--${size}`} role={onChange ? 'radiogroup' : 'img'} aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            className={n <= shown ? 'is-on' : ''}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
          >
            ★
          </button>
        ) : (
          <span key={n} className={n <= Math.round(shown) ? 'is-on' : ''} aria-hidden="true">
            ★
          </span>
        ),
      )}
    </span>
  );
}

/** Картинка с бэкенда (/uploads/...) или заглушка. */
export function Img({ src, alt = '', className = '', fallback }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  if (!url || failed) return fallback ?? <div className={`img-fallback ${className}`} aria-hidden="true" />;
  return <img src={url} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

/** Загрузка одного изображения с предпросмотром. */
export function ImageUpload({ current, onUpload, onDelete, label = 'Изображение' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await onUpload(file);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="image-upload">
      <span className="field__label">{label}</span>
      <div className="image-upload__row">
        <Img src={current} className="image-upload__preview" alt="" />
        <div className="image-upload__actions">
          <label className="btn btn--small btn--ghost">
            {busy ? 'Загрузка…' : current ? 'Заменить' : 'Загрузить'}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              disabled={busy}
              onChange={(e) => pick(e.target.files?.[0])}
            />
          </label>
          {current && onDelete && (
            <button type="button" className="btn btn--small btn--quiet" disabled={busy} onClick={onDelete}>
              Удалить
            </button>
          )}
          <p className="field__hint">JPG, PNG или WEBP до 5 МБ</p>
        </div>
      </div>
      <ErrorBox error={error} />
    </div>
  );
}
