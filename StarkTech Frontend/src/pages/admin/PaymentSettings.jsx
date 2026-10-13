// Админка → «Оплата»: реквизиты для переводов и правила предоплаты.
// Менять может только суперадмин (на бэкенде — право finance.view): так номер карты нельзя тихо подменить.
import '../../styles/payment.css';
import { useEffect, useState } from 'react';
import { paymentsApi } from '../../api/endpoints.js';
import { useAsync } from '../../lib/hooks.js';
import { dateTime } from '../../lib/format.js';
import { useToast } from '../../context/ToastContext.jsx';
import { Async, ErrorBox, Input, Textarea } from '../../components/ui.jsx';

const PRESETS = [0, 30, 50, 100];

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="pset-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="pset-toggle__track" aria-hidden="true" />
      <span className="pset-toggle__text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export default function PaymentSettings() {
  const toast = useToast();
  const settings = useAsync(() => paymentsApi.settings(), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (settings.data) setForm({ ...settings.data });
  }, [settings.data]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const setText = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await paymentsApi.updateSettings({ ...form, prepaymentPercent: Number(form.prepaymentPercent) || 0 });
      setForm({ ...saved });
      toast('Настройки оплаты сохранены');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const pct = Number(form?.prepaymentPercent) || 0;

  return (
    <div className="pset">
      <header className="admin-head">
        <div>
          <h1 className="admin-title">Оплата</h1>
          <p className="muted">
            Реквизиты, которые клиент видит после оформления заказа, и правила предоплаты. Клиент переводит деньги и
            загружает чек, а менеджер принимает его в карточке заказа.
          </p>
        </div>
      </header>

      <Async state={settings}>
        {() =>
          form && (
            <form className="pset-form" onSubmit={save}>
              <section className="pset-card pset-card--accent">
                <h2>Предоплата</h2>
                <p className="pset-card__lead">
                  {pct === 0
                    ? 'Без предоплаты: клиент оплачивает после подтверждения заказа менеджером.'
                    : pct === 100
                      ? 'Полная оплата сразу после оформления заказа.'
                      : `После оформления клиент переводит ${pct}% суммы, остаток — до получения заказа.`}
                </p>
                <div className="pset-percent">
                  <label className="pset-percent__input">
                    <span className="sr-only">Процент предоплаты</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      value={form.prepaymentPercent}
                      onChange={(e) => set('prepaymentPercent')(e.target.value)}
                    />
                    <span aria-hidden="true">%</span>
                  </label>
                  <div className="pset-presets" role="group" aria-label="Быстрый выбор">
                    {PRESETS.map((p) => (
                      <button key={p} type="button" className="site-pill" aria-pressed={pct === p} onClick={() => set('prepaymentPercent')(p)}>
                        {p === 0 ? 'Без предоплаты' : p === 100 ? 'Полная, 100%' : `${p}%`}
                      </button>
                    ))}
                  </div>
                </div>
                <Toggle
                  label="Предоплата и при оплате наличными"
                  hint="Если выключено — заказы «Наличными при получении» оплачиваются целиком курьеру."
                  checked={form.prepaymentForCash}
                  onChange={set('prepaymentForCash')}
                />
              </section>

              <section className="pset-card">
                <h2>Наличными при получении</h2>
                <Toggle label="Показывать способ на сайте" checked={form.cashEnabled} onChange={set('cashEnabled')} />
              </section>

              <section className="pset-card">
                <h2>Корти Миллӣ</h2>
                <Toggle label="Принимать переводы" checked={form.kortiMilliEnabled} onChange={set('kortiMilliEnabled')} />
                <div className="pset-grid">
                  <Input label="Номер карты" inputMode="numeric" maxLength={40} placeholder="0000 0000 0000 0000" value={form.kortiMilliCard ?? ''} onChange={setText('kortiMilliCard')} />
                  <Input label="Получатель" maxLength={120} placeholder="Имя Ф." value={form.kortiMilliHolder ?? ''} onChange={setText('kortiMilliHolder')} />
                </div>
              </section>

              <section className="pset-card">
                <h2>Alif Pay</h2>
                <Toggle label="Принимать переводы" checked={form.alifPayEnabled} onChange={set('alifPayEnabled')} />
                <div className="pset-grid">
                  <Input label="Номер телефона в Alif" type="tel" inputMode="tel" maxLength={40} placeholder="+992 90 000 00 00" value={form.alifPayPhone ?? ''} onChange={setText('alifPayPhone')} />
                  <Input label="Получатель" maxLength={120} value={form.alifPayHolder ?? ''} onChange={setText('alifPayHolder')} />
                </div>
              </section>

              <section className="pset-card">
                <h2>Перевод на карту</h2>
                <Toggle label="Принимать переводы" checked={form.cardTransferEnabled} onChange={set('cardTransferEnabled')} />
                <div className="pset-grid">
                  <Input label="Номер карты" inputMode="numeric" maxLength={40} value={form.cardTransferNumber ?? ''} onChange={setText('cardTransferNumber')} />
                  <Input label="Получатель" maxLength={120} value={form.cardTransferHolder ?? ''} onChange={setText('cardTransferHolder')} />
                  <Input label="Банк" maxLength={120} placeholder="Например, Душанбе Сити" value={form.cardTransferBank ?? ''} onChange={setText('cardTransferBank')} />
                </div>
              </section>

              <section className="pset-card">
                <h2>Подсказка клиенту</h2>
                <Textarea
                  label="Текст под реквизитами"
                  hint="Необязательно. Например: «Переводите точную сумму, чек проверяем в течение часа»."
                  maxLength={1000}
                  value={form.instructions ?? ''}
                  onChange={setText('instructions')}
                />
              </section>

              <div className="pset-actions">
                <ErrorBox error={error} />
                {form.updatedAt && <span className="muted small">Изменено {dateTime(form.updatedAt)}</span>}
                <button type="submit" className="btn btn--primary" disabled={busy}>
                  {busy ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </form>
          )
        }
      </Async>
    </div>
  );
}
