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

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  // Вызывающие передают стрелочные функции — храним свежий onClose в ref, чтобы эффект срабатывал один раз.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const panel = ref.current;
    const prevFocus = document.activeElement;
    // Начальный фокус: [autofocus] → первое поле в теле → сама панель.
    const first =
      panel.querySelector('[autofocus]') ||
      panel.querySelector(
        '.modal__body input:not([type="hidden"]):not([disabled]), .modal__body select:not([disabled]), .modal__body textarea:not([disabled]), .modal__body button:not([disabled])',
      ) ||
      panel;
    first.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (e.defaultPrevented) return;
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      // Ловушка фокуса: Tab / Shift+Tab ходят по кругу внутри окна.
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (!items.length) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const head = items[0];
      const tail = items[items.length - 1];
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        head.focus();
      } else if (e.shiftKey && (active === head || active === panel)) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && active === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      // Возвращаем фокус туда, откуда окно открыли.
      if (prevFocus && prevFocus.isConnected && typeof prevFocus.focus === 'function') prevFocus.focus({ preventScroll: true });
    };
  }, []);
  return (
    <div className="modal" onMouseDown={(e) => e.target === e.currentTarget && onCloseRef.current()}>
      <div
        className={`modal__panel ${wide ? 'modal__panel--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        ref={ref}
      >
        <header className="modal__head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

/**
 * Подпись + поле + подсказка/ошибка. children может быть функцией (id, a11y):
 * a11y — { 'aria-describedby', 'aria-invalid' } для самого поля.
 */
export function Field({ label, hint, error, children, className = '' }) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const showHint = hint && !error;
  const a11y = {
    'aria-describedby': error ? errorId : showHint ? hintId : undefined,
    'aria-invalid': error ? true : undefined,
  };
  const child = typeof children === 'function' ? children(id, a11y) : children;
  return (
    <div className={`field ${error ? 'field--error' : ''} ${className}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {child}
      {showHint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

// Свои aria-describedby вызывающего не теряем — добавляем к ним подсказку/ошибку.
const withA11y = (a11y, props) => ({
  ...props,
  'aria-describedby': [props['aria-describedby'], a11y['aria-describedby']].filter(Boolean).join(' ') || undefined,
  'aria-invalid': props['aria-invalid'] ?? a11y['aria-invalid'],
});

export function Input({ label, hint, error, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, a11y) => <input id={id} className="input" {...withA11y(a11y, props)} />}
    </Field>
  );
}

export function Textarea({ label, hint, error, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, a11y) => <textarea id={id} className="input input--area" rows={3} {...withA11y(a11y, props)} />}
    </Field>
  );
}

export function Select({ label, hint, error, options, placeholder, className, ...props }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id, a11y) => (
        <select id={id} className="input" {...withA11y(a11y, props)}>
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

// Статусы заказа красятся токенами --st-* (base.css: .badge--st-{Status}), оплата — тонами.
const ORDER_STATUSES = ['New', 'Confirmed', 'InProduction', 'ReadyForDelivery', 'Delivered', 'Cancelled'];

const PAYMENT_TONE = {
  Pending: 'grey',
  Paid: 'green',
  Failed: 'red',
  Refunded: 'grey',
  PartiallyPaid: 'yellow',
};

export function Badge({ tone = 'grey', children }) {
  return <span className={`badge badge--${tone}`}>{children}</span>;
}

export const OrderStatusBadge = ({ status }) => (
  <span className={ORDER_STATUSES.includes(status) ? `badge badge--st badge--st-${status}` : 'badge badge--grey'}>
    {ORDER_STATUS[status] || status}
  </span>
);
export const PaymentStatusBadge = ({ status }) => (
  <Badge tone={PAYMENT_TONE[status]}>{PAYMENT_STATUS[status] || status}</Badge>
);

export function Stars({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  const groupRef = useRef(null);

  // Радиогруппа по шаблону WAI-ARIA: в фокусе одна звезда, стрелки меняют оценку.
  const onKeyDown = (e) => {
    const next =
      e.key === 'ArrowRight' || e.key === 'ArrowUp'
        ? Math.min(5, (value || 0) + 1)
        : e.key === 'ArrowLeft' || e.key === 'ArrowDown'
          ? Math.max(1, (value || 1) - 1)
          : e.key === 'Home'
            ? 1
            : e.key === 'End'
              ? 5
              : null;
    if (next == null) return;
    e.preventDefault();
    onChange(next);
    groupRef.current?.querySelectorAll('button')[next - 1]?.focus();
  };

  return (
    <span
      className={`stars stars--${size}`}
      role={onChange ? 'radiogroup' : 'img'}
      aria-label={onChange ? 'Оценка' : `Оценка ${value} из 5`}
      ref={groupRef}
      onKeyDown={onChange ? onKeyDown : undefined}
    >
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} из 5`}
            tabIndex={value === n || (!value && n === 1) ? 0 : -1}
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
export function Img({ src, alt = '', className = '', fallback, loading = 'lazy', fetchPriority, width, height }) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);
  if (!url || failed) return fallback ?? <div className={`img-fallback ${className}`} aria-hidden="true" />;
  return (
    <img
      src={url}
      alt={alt}
      className={className}
      loading={loading}
      // React 18 не знает fetchPriority — передаём атрибутом в нижнем регистре.
      fetchpriority={fetchPriority}
      width={width}
      height={height}
      onError={() => setFailed(true)}
    />
  );
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
          <label className="btn btn--small btn--ghost image-upload__pick">
            {busy ? 'Загрузка…' : current ? 'Заменить' : 'Загрузить'}
            {/* Не hidden, а визуально скрыт — так поле остаётся в порядке Tab, а кольцо фокуса рисует label */}
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
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
