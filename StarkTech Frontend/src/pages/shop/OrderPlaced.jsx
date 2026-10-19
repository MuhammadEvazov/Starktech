import '../../styles/site/checkout.css';
import { useState } from 'react';
import { Link, useLocation, useParams } from '../../lib/router.jsx';

// Тот же ключ, что пишет Checkout.jsx (orderIssuesKey).
const orderIssuesKey = (number) => `st_order_issues:${number}`;
import { useAuth } from '../../context/AuthContext.jsx';
import { money } from '../../lib/format.js';
import { useAsync } from '../../lib/hooks.js';
import { ordersApi } from '../../api/endpoints.js';
import PaymentBox from '../../components/PaymentBox.jsx';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';

export default function OrderPlaced() {
  const { number } = useParams();
  const { state } = useLocation();
  const { isAuthenticated } = useAuth();
  const order = state?.order;
  // Проблемы после оформления (фото, «Запомнить») — из state или из localStorage, чтобы пережить перезагрузку.
  const [issues, setIssues] = useState(() => {
    if (state?.issues) return state.issues;
    try {
      return JSON.parse(localStorage.getItem(orderIssuesKey(number)) || 'null');
    } catch {
      return null;
    }
  });
  const photoIssues = issues ? issues.uploadFailed + issues.cropFailed + issues.skipped : 0;
  const orderId = order?.id ?? issues?.orderId;
  const dismissIssues = () => {
    try {
      localStorage.removeItem(orderIssuesKey(number));
    } catch { /* ignore */ }
    setIssues(null);
  };
  // Полный заказ (с суммами предоплаты) — для блока оплаты; после перезагрузки страницы state пропадает.
  const full = useAsync(() => (order?.id ? ordersApi.mineGet(order.id) : Promise.resolve(null)), [order?.id]);

  const steps = [
    {
      title: 'Звонок менеджера',
      text: 'Позвоним по твоему номеру, уточним детали и согласуем макет.',
    },
    {
      title: `Изготовление — ${CONTACTS.leadTime}`,
      text: 'Печатаем твои фото, как только ты одобришь макет.',
    },
    {
      title: 'Доставка',
      text: 'Привезём по указанному адресу или пригласим забрать заказ.',
    },
  ];

  return (
    <div className="done-page">
      <header className="done-hero">
        <div className="done-sticker">
          <span className="done-sticker__label">Номер заказа</span>
          <span className="done-sticker__number">{number}</span>
        </div>
        <h1 className="done-title">Спасибо, заказ принят!</h1>
        <p className="site-lead">Менеджер позвонит тебе, чтобы подтвердить детали и согласовать макет.</p>
      </header>

      {order && (
        <dl className="site-surface done-facts">
          <div className="done-facts__main">
            <dt>К оплате</dt>
            <dd>{money(order.payableAmount)}</dd>
          </div>
          {Number(order.discountAmount) > 0 && (
            <div>
              <dt>Скидка</dt>
              <dd>{money(order.discountAmount)}</dd>
            </div>
          )}
          <div>
            <dt>Доставка</dt>
            <dd>{Number(order.deliveryCost) === 0 ? 'бесплатно' : money(order.deliveryCost)}</dd>
          </div>
        </dl>
      )}

      {full.data ? (
        <PaymentBox order={full.data} onChanged={full.reload} />
      ) : (
        !order && (
          <p className="done-note">
            Оплатить заказ и следить за ним можно в{' '}
            <Link to="/account" className="text-link">
              личном кабинете
            </Link>
            .
          </p>
        )
      )}

      {photoIssues > 0 && (
        <div className="done-note done-issue" role="status">
          <p>
            {issues.uploadFailed + issues.skipped > 0 &&
              `Не загрузились фото: ${issues.uploadFailed + issues.skipped}. `}
            {issues.cropFailed > 0 &&
              `Фото загружены, но не сохранился кадр под форму: ${issues.cropFailed}. `}
            Они не потерялись — остались в{' '}
            <Link to="/cart" className="text-link">
              корзине
            </Link>{' '}
            с кнопкой «Загрузить ещё раз». Добавить фото можно и{' '}
            {isAuthenticated && orderId ? (
              <Link to={`/account/orders/${orderId}`} className="text-link">
                на странице заказа в кабинете
              </Link>
            ) : (
              'на странице заказа в кабинете'
            )}{' '}
            или{' '}
            <a href={whatsappWith(`Здравствуйте! Отправляю фото к заказу ${number}.`)} target="_blank" rel="noopener noreferrer" className="text-link">
              отправить в WhatsApp
            </a>
            .
          </p>
        </div>
      )}

      {issues?.rememberFailed && (
        <p className="done-note" role="status">
          Не удалось сохранить телефон и адрес в профиле — заказ оформлен, а данные можно обновить в личном кабинете.
        </p>
      )}

      {issues && (
        <button type="button" className="btn btn--ghost done-issue__hide" onClick={dismissIssues}>
          Понятно, скрыть
        </button>
      )}

      <section className="done-next" aria-labelledby="done-next-title">
        <h2 id="done-next-title">Что дальше</h2>
        <ol className="done-steps">
          {steps.map((s, i) => (
            <li key={s.title}>
              <span className="done-steps__num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="done-steps__title">{s.title}</span>
              <span className="done-steps__text">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="done-actions">
        {isAuthenticated && (
          <Link to={orderId ? `/account/orders/${orderId}` : '/account'} className="btn btn--primary btn--large">
            {orderId ? 'Открыть заказ' : 'Мои заказы'}
          </Link>
        )}
        <Link to="/catalog" className={`btn btn--large ${isAuthenticated ? 'btn--ghost' : 'btn--primary'}`}>
          Продолжить покупки
        </Link>
      </div>

      <p className="done-help">
        Есть вопрос по заказу?{' '}
        <a
          href={whatsappWith(`Здравствуйте! Вопрос по заказу ${number}.`)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link"
        >
          Напиши нам в WhatsApp
        </a>
      </p>
    </div>
  );
}
