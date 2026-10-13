// Админка → заказ → «Оплата»: предоплата, сколько принято и осталось, чеки клиента.
// Чек можно принять (сумму можно поправить — если перевели не столько, сколько указал клиент)
// или отклонить с причиной — клиент увидит её в личном кабинете.
import '../../styles/payment.css';
import { useState } from 'react';
import { paymentsApi } from '../../api/endpoints.js';
import { assetUrl } from '../../api/client.js';
import { useAsync } from '../../lib/hooks.js';
import { dateTime, money, PAYMENT_PROOF_STATUS } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { ErrorBox } from '../../components/ui.jsx';
import PhotoZoom from '../../components/PhotoZoom.jsx';

const toNumber = (v) => Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));

export default function PaymentReview({ order: o, onChanged }) {
  const toast = useToast();
  const proofs = useAsync(() => paymentsApi.proofs(o.id), [o.id, o.paidAmount, o.hasPendingPaymentProof]);
  const [amounts, setAmounts] = useState({});
  const [rejecting, setRejecting] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);

  const list = proofs.data ?? [];
  const pct = o.prepaymentPercent ?? 0;

  const run = async (id, fn, msg) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      toast(msg);
      setRejecting(null);
      setReason('');
      proofs.reload();
      onChanged?.();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(null);
    }
  };

  const approve = (p) => {
    const value = toNumber(amounts[p.id] ?? p.amount);
    if (!(value > 0)) return setError({ messages: ['Укажите принятую сумму.'] });
    // Больше остатка принять нельзя — лишнее пришлось бы возвращать (сервер проверяет то же).
    const left = Number(o.remainingAmount) || 0;
    if (value > left) return setError({ messages: [`Сумма больше остатка к оплате (${money(left)}). Примите не больше остатка, а переплату верните клиенту.`] });
    run(p.id, () => paymentsApi.approve(p.id, value), `Чек принят: ${money(value)}`);
  };

  const reject = (p) => {
    if (!reason.trim()) return setError({ messages: ['Напишите причину — клиент её увидит.'] });
    run(p.id, () => paymentsApi.reject(p.id, reason.trim()), 'Чек отклонён');
  };

  return (
    <div className="pay-review">
      <dl className="pay-sums pay-sums--compact">
        {pct > 0 && (
          <div>
            <dt>Предоплата {pct}%</dt>
            <dd>{money(o.prepaymentAmount)}</dd>
          </div>
        )}
        <div>
          <dt>Оплачено</dt>
          <dd>{money(o.paidAmount)}</dd>
        </div>
        <div className="is-main">
          <dt>Осталось</dt>
          <dd>{money(o.remainingAmount)}</dd>
        </div>
        {Number(o.overpaidAmount) > 0 && (
          <div>
            <dt>Переплата — вернуть</dt>
            <dd>{money(o.overpaidAmount)}</dd>
          </div>
        )}
      </dl>

      {list.length === 0 ? (
        <p className="pay-note">
          {o.paymentMethod === 'Cash' && pct === 0
            ? 'Оплата наличными при получении — чеков нет.'
            : 'Клиент ещё не загрузил чек перевода.'}
        </p>
      ) : (
        <ul className="pay-proofs__list">
          {list.map((p) => (
            <li key={p.id} className={`pay-proof is-${p.status.toLowerCase()}`}>
              <button
                type="button"
                className="pay-proof__img"
                aria-label={`Открыть чек на ${money(p.amount)}`}
                onClick={() => setZoom({ src: assetUrl(p.imageUrl), title: `Чек на ${money(p.amount)}` })}
              >
                <img src={assetUrl(p.imageUrl)} alt="" loading="lazy" />
              </button>
              <div className="pay-proof__info">
                <strong>Клиент указал {money(p.amount)}</strong>
                <span>{dateTime(p.createdAt)}</span>
                {p.comment && <span className="pay-proof__comment">«{p.comment}»</span>}
                {p.status === 'Approved' && (
                  <span>
                    Принято {money(p.approvedAmount)} · {p.reviewedBy}
                  </span>
                )}
                {p.status === 'Rejected' && (
                  <span className="pay-proof__reason">
                    Отклонён: {p.rejectReason} · {p.reviewedBy}
                  </span>
                )}

                {p.status === 'Pending' &&
                  (rejecting === p.id ? (
                    <div className="pay-review__actions">
                      <input
                        className="input"
                        autoFocus
                        maxLength={300}
                        placeholder="Причина: сумма не совпадает, чек нечитаемый…"
                        aria-label="Причина отклонения"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                      />
                      <button type="button" className="btn btn--danger btn--small" disabled={busy === p.id} onClick={() => reject(p)}>
                        Отклонить
                      </button>
                      <button type="button" className="btn btn--ghost btn--small" onClick={() => setRejecting(null)}>
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <div className="pay-review__actions">
                      <label className="pay-review__amount">
                        <span className="sr-only">Принятая сумма</span>
                        <input
                          className="input"
                          inputMode="decimal"
                          value={amounts[p.id] ?? String(p.amount)}
                          onChange={(e) => setAmounts((a) => ({ ...a, [p.id]: e.target.value }))}
                        />
                        <span aria-hidden="true">смн</span>
                      </label>
                      <button type="button" className="btn btn--primary btn--small" disabled={busy === p.id} onClick={() => approve(p)}>
                        Принять
                      </button>
                      <button
                        type="button"
                        className="btn btn--ghost btn--small"
                        onClick={() => {
                          setRejecting(p.id);
                          setReason('');
                        }}
                      >
                        Отклонить
                      </button>
                    </div>
                  ))}
              </div>
              <span className="pay-proof__status">{PAYMENT_PROOF_STATUS[p.status] || p.status}</span>
            </li>
          ))}
        </ul>
      )}
      <ErrorBox error={error || proofs.error} />
      {zoom && <PhotoZoom src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
    </div>
  );
}
