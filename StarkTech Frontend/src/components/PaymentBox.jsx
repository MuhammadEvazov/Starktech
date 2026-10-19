// Оплата заказа переводом для покупателя: сколько перевести (предоплата / остаток), реквизиты
// с кнопкой «Копировать», загрузка скриншота чека и статусы уже присланных чеков.
// Используется на странице «Заказ принят» и в личном кабинете на странице заказа.
import '../styles/payment.css';
import { useEffect, useRef, useState } from 'react';
import { paymentsApi } from '../api/endpoints.js';
import { assetUrl } from '../api/client.js';
import { useAsync } from '../lib/hooks.js';
import { dateTime, money, PAYMENT_METHOD, PAYMENT_PROOF_STATUS } from '../lib/format.js';
import { useToast } from '../context/ToastContext.jsx';
import { ErrorBox, PaymentStatusBadge } from './ui.jsx';
import PhotoZoom from './PhotoZoom.jsx';

// Способы, которые оплачиваются переводом (наличные — курьеру).
const TRANSFER_METHODS = ['KortiMilli', 'AlifPay', 'CardTransfer'];

/** Реквизиты способа оплаты из настроек магазина или null, если способ выключен/не заполнен. */
export function transferDetails(s, method) {
  if (!s) return null;
  if (method === 'KortiMilli' && s.kortiMilliEnabled && s.kortiMilliCard)
    return { label: 'Номер карты', value: s.kortiMilliCard, holder: s.kortiMilliHolder };
  if (method === 'AlifPay' && s.alifPayEnabled && s.alifPayPhone)
    return { label: 'Номер в Alif', value: s.alifPayPhone, holder: s.alifPayHolder };
  if (method === 'CardTransfer' && s.cardTransferEnabled && s.cardTransferNumber)
    return { label: 'Номер карты', value: s.cardTransferNumber, holder: s.cardTransferHolder, bank: s.cardTransferBank };
  return null;
}

function CopyButton({ text, label = 'Копировать' }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return undefined;
    const t = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button
      type="button"
      className={`pay-copy${done ? ' is-done' : ''}`}
      onClick={() =>
        navigator.clipboard
          ?.writeText(text)
          .then(() => setDone(true))
          .catch(() => {})
      }
    >
      {done ? 'Скопировано ✓' : label}
    </button>
  );
}

const toNumber = (v) => Number(String(v ?? '').replace(',', '.').replace(/\s/g, ''));
// Суммы — с точностью до дирамов (2 знака), как на сервере.
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

export default function PaymentBox({ order: o, onChanged }) {
  const toast = useToast();
  const settings = useAsync(() => paymentsApi.settings(), []);
  const proofs = useAsync(() => paymentsApi.myProofs(o.id), [o.id]);
  const [expanded, setExpanded] = useState(false);
  const [method, setMethod] = useState(null);
  const [amount, setAmount] = useState('');
  const [file, setFile] = useState(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [zoom, setZoom] = useState(null);
  const fileRef = useRef(null);

  const payable = Number(o.payableAmount ?? 0);
  const remaining = Number(o.remainingAmount ?? 0);
  const dueNow = Number(o.dueNowAmount ?? 0);
  const paid = Number(o.paidAmount ?? 0);
  const pct = o.prepaymentPercent ?? 0;

  // Сумма в поле по умолчанию: недостающая предоплата, иначе весь остаток.
  useEffect(() => {
    setAmount(String(round2(dueNow > 0 ? dueNow : remaining)));
  }, [dueNow, remaining]);

  const overpaid = Number(o.overpaidAmount ?? 0);
  const refundDue = Number(o.refundDueAmount ?? 0);

  // Отменённый заказ: форму оплаты не показываем; если деньги уже приходили — сообщаем о возврате.
  if (o.status === 'Cancelled') {
    if (o.paymentStatus === 'Refunded' && paid > 0) {
      return (
        <section className="pay-box pay-box--done pay-box--refund" aria-label="Оплата">
          <span className="pay-box__icon" aria-hidden="true">↩</span>
          <div>
            <strong>Деньги возвращены</strong>
            <p>Заказ отменён, оплата {money(paid)} возвращена.</p>
          </div>
        </section>
      );
    }
    if (refundDue > 0) {
      return (
        <section className="pay-box pay-box--done pay-box--refund" aria-label="Оплата">
          <span className="pay-box__icon" aria-hidden="true">↩</span>
          <div>
            <strong>К возврату {money(refundDue)}</strong>
            <p>Заказ отменён. Менеджер вернёт оплаченную сумму — если есть вопросы, напиши в чат.</p>
          </div>
        </section>
      );
    }
    return null;
  }

  const proofList = proofs.data ?? [];
  const pendingProof = proofList.some((p) => p.status === 'Pending');

  if (o.paymentStatus === 'Refunded') {
    return (
      <section className="pay-box pay-box--done pay-box--refund" aria-label="Оплата">
        <span className="pay-box__icon" aria-hidden="true">↩</span>
        <div>
          <strong>Оплата возвращена</strong>
          <p>Менеджер оформил возврат. Если есть вопросы, напиши в чат.</p>
        </div>
      </section>
    );
  }

  if (o.paymentStatus === 'Paid' || (remaining <= 0 && paid > 0)) {
    return (
      <section className="pay-box pay-box--done" aria-label="Оплата">
        <span className="pay-box__icon" aria-hidden="true">✓</span>
        <div>
          <strong>Заказ оплачен</strong>
          <p>Получено {money(paid > 0 ? paid : payable)}. Спасибо!</p>
          {overpaid > 0 && <p className="pay-box__over">Переплата {money(overpaid)} — менеджер вернёт.</p>}
        </div>
      </section>
    );
  }
  if (remaining <= 0) return null;

  const s = settings.data;
  const methods = TRANSFER_METHODS.filter((m) => transferDetails(s, m));
  const current = method && methods.includes(method) ? method : methods.includes(o.paymentMethod) ? o.paymentMethod : methods[0];
  const details = transferDetails(s, current);

  // Наличными без предоплаты — платить переводом не обязательно; пока заказ «Новый» и предоплаты нет —
  // ждём подтверждения менеджера (сумма ещё может измениться). В обоих случаях блок свёрнут.
  const cashOnly = o.paymentMethod === 'Cash' && pct === 0;
  const waitConfirm = !cashOnly && pct === 0 && o.status === 'New';
  const collapsed = (cashOnly || waitConfirm) && !expanded && paid === 0;

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const raw = toNumber(amount);
    const value = Number.isFinite(raw) ? round2(raw) : NaN;
    if (!file) return setError({ messages: ['Прикрепи скриншот или фото чека перевода.'] });
    if (!(value > 0)) return setError({ messages: ['Укажи сумму перевода.'] });
    if (value > remaining) return setError({ messages: [`Сумма больше, чем осталось оплатить (${money(remaining)}).`] });
    setBusy(true);
    try {
      await paymentsApi.uploadProof(o.id, file, { amount: value, comment: comment.trim() || undefined });
      toast('Чек отправлен — менеджер проверит оплату');
      setFile(null);
      setComment('');
      if (fileRef.current) fileRef.current.value = '';
      proofs.reload();
      onChanged?.();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={`pay-box${dueNow > 0 ? ' pay-box--due' : ''}`} aria-labelledby={`pay-title-${o.id}`}>
      <header className="pay-box__head">
        <div>
          <h3 id={`pay-title-${o.id}`}>
            {dueNow > 0 ? `Предоплата ${pct}%` : cashOnly ? 'Оплата при получении' : waitConfirm && paid === 0 ? 'Оплата после подтверждения' : 'Оплата заказа'}
          </h3>
          <p>
            {dueNow > 0
              ? 'Переведи предоплату и загрузи чек — после проверки мы начнём работу над заказом.'
              : cashOnly
                ? `Оплати ${money(remaining)} наличными курьеру или при самовывозе. Можно и переводом заранее.`
                : waitConfirm && paid === 0
                  ? 'Менеджер подтвердит заказ — после этого переведи сумму. Можно оплатить и сейчас.'
                  : 'Переведи оставшуюся сумму удобным способом и загрузи чек.'}
          </p>
        </div>
        <PaymentStatusBadge status={o.paymentStatus} />
      </header>

      <dl className="pay-sums">
        <div>
          <dt>Сумма заказа</dt>
          <dd>{money(payable)}</dd>
        </div>
        <div>
          <dt>Оплачено</dt>
          <dd>{money(paid)}</dd>
        </div>
        <div className={dueNow > 0 ? '' : 'is-main'}>
          <dt>Осталось</dt>
          <dd>{money(remaining)}</dd>
        </div>
        {dueNow > 0 && (
          <div className="is-main">
            <dt>Перевести сейчас</dt>
            <dd>{money(dueNow)}</dd>
          </div>
        )}
      </dl>

      {pendingProof && (
        <p className="pay-note pay-note--wait" role="status">
          Чек на проверке — менеджер подтвердит оплату, статус обновится здесь.
        </p>
      )}

      {collapsed ? (
        <button type="button" className="btn btn--ghost pay-box__expand" onClick={() => setExpanded(true)}>
          {cashOnly ? 'Оплатить переводом заранее' : 'Оплатить сейчас'}
        </button>
      ) : settings.loading && !s ? (
        <p className="pay-note">Загружаем реквизиты…</p>
      ) : !methods.length ? (
        <p className="pay-note">Реквизиты для перевода пока не указаны — менеджер подскажет, как оплатить.</p>
      ) : (
        <>
          {methods.length > 1 && (
            <div className="pay-methods" role="group" aria-label="Способ перевода">
              {methods.map((m) => (
                <button key={m} type="button" className="site-pill" aria-pressed={m === current} onClick={() => setMethod(m)}>
                  {PAYMENT_METHOD[m]}
                </button>
              ))}
            </div>
          )}

          <div className="pay-details">
            <div className="pay-details__row">
              <span className="pay-details__label">{details.label}</span>
              <span className="pay-details__value">{details.value}</span>
              <CopyButton text={details.value.replace(/\s/g, '')} />
            </div>
            {details.holder && (
              <div className="pay-details__row">
                <span className="pay-details__label">Получатель</span>
                <span className="pay-details__text">{details.holder}</span>
              </div>
            )}
            {details.bank && (
              <div className="pay-details__row">
                <span className="pay-details__label">Банк</span>
                <span className="pay-details__text">{details.bank}</span>
              </div>
            )}
            <div className="pay-details__row">
              <span className="pay-details__label">Комментарий к переводу</span>
              <span className="pay-details__text">Заказ {o.orderNumber}</span>
              <CopyButton text={o.orderNumber} />
            </div>
            {s.instructions && <p className="pay-details__hint">{s.instructions}</p>}
          </div>

          <form className="pay-upload" onSubmit={submit}>
            <label className="pay-upload__field">
              <span>Сумма перевода, смн</span>
              <input
                className="input"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                onBlur={() => {
                  const v = toNumber(amount);
                  if (Number.isFinite(v) && v > 0) setAmount(String(round2(v)));
                }}
                aria-describedby={`pay-max-${o.id}`}
              />
              <small id={`pay-max-${o.id}`}>Максимум {money(remaining)}</small>
            </label>
            <label className="pay-upload__file">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <span className="pay-upload__drop">
                {file ? (
                  <>
                    <strong>{file.name}</strong>
                    <small>Нажми, чтобы выбрать другой файл</small>
                  </>
                ) : (
                  <>
                    <strong>Загрузи чек</strong>
                    <small>Скриншот из приложения банка — JPG, PNG или WEBP до 5 МБ</small>
                  </>
                )}
              </span>
            </label>
            <label className="pay-upload__field pay-upload__wide">
              <span>Комментарий (необязательно)</span>
              <input className="input" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <ErrorBox error={error} />
            <button type="submit" className="btn btn--primary pay-upload__submit" disabled={busy}>
              {busy ? 'Отправляем…' : 'Отправить чек'}
            </button>
          </form>
        </>
      )}

      {proofList.length > 0 && (
        <div className="pay-proofs">
          <h4>Отправленные чеки</h4>
          <ul>
            {proofList.map((p) => (
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
                  <strong>{money(p.approvedAmount ?? p.amount)}</strong>
                  <span>{dateTime(p.createdAt)}</span>
                  {p.comment && <span className="pay-proof__comment">{p.comment}</span>}
                  {p.status === 'Rejected' && p.rejectReason && <span className="pay-proof__reason">Причина: {p.rejectReason}</span>}
                </div>
                <span className="pay-proof__status">{PAYMENT_PROOF_STATUS[p.status] || p.status}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {zoom && <PhotoZoom src={zoom.src} title={zoom.title} onClose={() => setZoom(null)} />}
    </section>
  );
}
