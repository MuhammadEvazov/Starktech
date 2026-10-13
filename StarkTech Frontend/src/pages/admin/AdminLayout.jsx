import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Routes, useLocation } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../lib/format.js';
import Dashboard from './Dashboard.jsx';
import { Orders, OrderDetail } from './Orders.jsx';
import { Products, ProductDetail } from './Products.jsx';
import { Categories, CategoryDetail } from './Categories.jsx';
import { Cities, PromoCodes, ComboOffers, PortfolioAdmin } from './Simple.jsx';
import Reviews from './Reviews.jsx';
import { Users, Coins, Permissions, Notifications, Telegram } from './People.jsx';
import AdminChat from './Chat.jsx';
import PaymentSettings from './PaymentSettings.jsx';
import { chatApi } from '../../api/endpoints.js';
import { useChatHub, useHubEvent } from '../../lib/chatHub.js';
import '../../styles/admin.css';
import '../../styles/chat.css';

const NAV = [
  {
    group: 'Продажи',
    links: [
      { to: '/admin', label: 'Обзор', end: true },
      { to: '/admin/orders', label: 'Заказы' },
      { to: '/admin/chat', label: 'Чат', badge: 'chat' },
      { to: '/admin/payment', label: 'Оплата', superOnly: true },
      { to: '/admin/notifications', label: 'Уведомления' },
    ],
  },
  {
    group: 'Каталог',
    links: [
      { to: '/admin/products', label: 'Товары' },
      { to: '/admin/categories', label: 'Категории' },
      { to: '/admin/portfolio', label: 'Портфолио' },
    ],
  },
  {
    group: 'Маркетинг',
    links: [
      { to: '/admin/promo-codes', label: 'Промокоды' },
      { to: '/admin/combo-offers', label: 'Комбо-предложения' },
      { to: '/admin/reviews', label: 'Отзывы' },
      { to: '/admin/delivery-cities', label: 'Города доставки' },
    ],
  },
  {
    group: 'Команда и клиенты',
    links: [
      { to: '/admin/users', label: 'Пользователи', superOnly: true },
      { to: '/admin/coins', label: 'Монеты', superOnly: true },
      { to: '/admin/permissions', label: 'Права ролей', superOnly: true },
      { to: '/admin/telegram', label: 'Telegram' },
    ],
  },
];

/** Короткий сигнал о новом сообщении клиента (если браузер разрешает звук). */
function ping() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
    osc.onended = () => ctx.close();
  } catch {
    /* звук недоступен — не страшно */
  }
}

/** Непрочитанные сообщения клиентов во всех переписках — для бейджа «Чат» в меню. */
function useStaffChatUnread() {
  const hub = useChatHub(true);
  const [unread, setUnread] = useState(0);
  const last = useRef(0);
  const timer = useRef(null);

  const refresh = (withSound) =>
    chatApi
      .unread()
      .then((u) => {
        const next = u?.staff ?? 0;
        if (withSound && next > last.current) ping();
        last.current = next;
        setUnread(next);
      })
      .catch(() => {});

  useEffect(() => {
    refresh(false);
  }, [hub.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), []);

  useHubEvent(hub.connection, 'ConversationUpdated', () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => refresh(true), 250);
  });
  return unread;
}

export default function AdminLayout() {
  const { profile, roles, isSuperAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const chatUnread = useStaffChatUnread();

  return (
    <div className="admin">
      {/* Фокус переводим сами: смена хеша дёрнула бы popstate у роутера */}
      <a
        href="#admin-main"
        className="adm-skip"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('admin-main')?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <aside className={`admin-side ${open ? 'is-open' : ''}`}>
        <div className="admin-side__top">
          <Link to="/" className="admin-brand">
            StarkTech <span>админка</span>
          </Link>
          <button type="button" className="admin-side__toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? 'Скрыть' : 'Меню'}
          </button>
        </div>
        <nav className="admin-nav" onClick={() => setOpen(false)} aria-label="Разделы админки">
          {NAV.map((g) => (
            <div key={g.group} className="admin-nav__group">
              <p className="admin-nav__label">{g.group}</p>
              {g.links
                .filter((l) => !l.superOnly || isSuperAdmin)
                .map((l) => (
                  <NavLink key={l.to} to={l.to} end={l.end}>
                    {l.label}
                    {l.badge === 'chat' && chatUnread > 0 && (
                      <span className="admin-nav__badge">
                        <span aria-hidden="true">{chatUnread > 99 ? '99+' : chatUnread}</span>
                        <span className="sr-only">, непрочитанных: {chatUnread}</span>
                      </span>
                    )}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="admin-side__user">
          <strong>{profile?.fullName || profile?.email}</strong>
          <span>{roles.map((r) => ROLES[r] || r).join(', ')}</span>
          <div className="admin-side__links">
            <Link to="/">На сайт</Link>
            <button type="button" onClick={logout}>
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <main id="admin-main" tabIndex={-1} className="admin-main" key={pathname.split('/')[2] || 'home'}>
        <Routes
          routes={[
            { path: '/admin', element: <Dashboard /> },
            { path: '/admin/orders', element: <Orders /> },
            { path: '/admin/orders/:id', element: <OrderDetail /> },
            { path: '/admin/chat', element: <AdminChat /> },
            { path: '/admin/payment', element: <PaymentSettings /> },
            { path: '/admin/products', element: <Products /> },
            { path: '/admin/products/:id', element: <ProductDetail /> },
            { path: '/admin/categories', element: <Categories /> },
            { path: '/admin/categories/:id', element: <CategoryDetail /> },
            { path: '/admin/portfolio', element: <PortfolioAdmin /> },
            { path: '/admin/promo-codes', element: <PromoCodes /> },
            { path: '/admin/combo-offers', element: <ComboOffers /> },
            { path: '/admin/reviews', element: <Reviews /> },
            { path: '/admin/delivery-cities', element: <Cities /> },
            { path: '/admin/users', element: <Users /> },
            { path: '/admin/coins', element: <Coins /> },
            { path: '/admin/permissions', element: <Permissions /> },
            { path: '/admin/notifications', element: <Notifications /> },
            { path: '/admin/telegram', element: <Telegram /> },
          ]}
          fallback={<p className="muted">Раздел не найден.</p>}
        />
      </main>
    </div>
  );
}
