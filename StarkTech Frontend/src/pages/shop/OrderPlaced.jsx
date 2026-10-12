import '../../styles/site/checkout.css';
import { Link, useLocation, useParams } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { money } from '../../lib/format.js';
import { CONTACTS, whatsappWith } from '../../lib/contacts.js';

export default function OrderPlaced() {
  const { number } = useParams();
  const { state } = useLocation();
  const { isAuthenticated } = useAuth();
  const order = state?.order;

  const steps = [
    {
      title: 'Звонок менеджера',
      text: 'Позвоним по указанному номеру, уточним детали и согласуем макет.',
    },
    {
      title: `Изготовление — ${CONTACTS.leadTime}`,
      text: 'Печатаем ваши фото после того, как вы одобрите макет.',
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
        <h1 className="site-title">Спасибо, заказ принят</h1>
        <p className="site-lead">Менеджер позвонит, чтобы подтвердить детали и согласовать макет.</p>
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

      {state?.guestPhotos > 0 && (
        <p className="done-note" role="status">
          Ваши фото ({state.guestPhotos}) не прикрепились к заказу: без входа в аккаунт их нельзя загрузить на сайт.{' '}
          <a href={whatsappWith(`Здравствуйте! Отправляю фото к заказу ${number}.`)} target="_blank" rel="noopener noreferrer" className="text-link">
            Отправьте их в WhatsApp
          </a>{' '}
          с номером заказа — менеджер добавит их сам.
        </p>
      )}

      {state?.photoFailures > 0 && (
        <p className="done-note" role="status">
          Не удалось загрузить фото: {state.photoFailures}. Добавьте их в личном кабинете на странице заказа.
        </p>
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
          <Link to={order ? `/account/orders/${order.id}` : '/account'} className="btn btn--primary btn--large">
            {order ? 'Открыть заказ' : 'Мои заказы'}
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
          Напишите нам в WhatsApp
        </a>
      </p>
    </div>
  );
}
