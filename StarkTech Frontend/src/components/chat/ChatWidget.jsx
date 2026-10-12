// Кнопка «Написать нам» + окно чата с менеджером (SignalR). Гостю предлагаем войти — переписка
// привязана к аккаунту и сохраняется; мессенджеры остаются запасным путём.
// Открыть чат из любого места сайта: window.dispatchEvent(new Event('chat:open')).
import '../../styles/chat.css';
import { useEffect, useState } from 'react';
import { Link, useLocation } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { chatApi } from '../../api/endpoints.js';
import { CONTACTS } from '../../lib/contacts.js';
import { useChatHub, useHubEvent } from '../../lib/chatHub.js';
import ChatThread from './ChatThread.jsx';

const QUICK = ['Сколько стоит стикер?', 'Сколько делается заказ?', 'Есть доставка в мой город?', 'Хочу узнать про свой заказ'];

function BrandAvatar() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="chatw-brand">
      <path d="M32 56 C10 42 4 30 8 20 C12 10 26 8 32 20 C38 8 52 10 56 20 C60 30 54 42 32 56Z" fill="#fff" />
    </svg>
  );
}

function Messengers() {
  return (
    <div className="chatw-messengers">
      <a href={CONTACTS.whatsapp} target="_blank" rel="noopener noreferrer" className="is-wa">
        WhatsApp
      </a>
      <a href={CONTACTS.telegram} target="_blank" rel="noopener noreferrer" className="is-tg">
        Telegram
      </a>
      <a href={CONTACTS.instagram} target="_blank" rel="noopener noreferrer" className="is-ig">
        Instagram
      </a>
    </div>
  );
}

export default function ChatWidget() {
  const { isAuthenticated, profile } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const hub = useChatHub(isAuthenticated);

  // Сменился пользователь (выход/вход) — забываем прошлую переписку.
  useEffect(() => {
    setConversation(null);
    setUnread(0);
    setError(null);
  }, [isAuthenticated, profile?.id]);

  // Непрочитанные ответы — бейдж на кнопке; обновляем и после переподключения.
  useEffect(() => {
    if (!isAuthenticated) return;
    chatApi
      .unread()
      .then((u) => setUnread(u?.mine ?? 0))
      .catch(() => {});
  }, [isAuthenticated, hub.connected]);

  useHubEvent(hub.connection, 'ConversationUpdated', (c) => {
    // Сотрудник получает обновления всех переписок — берём только свою.
    if (!profile?.id || c.customerId !== profile.id) return;
    setUnread(c.unreadByCustomer);
    setConversation((cur) => (cur && cur.id === c.id ? c : cur));
  });

  // Переписка создаётся при первом открытии окна.
  useEffect(() => {
    if (!open || !isAuthenticated || conversation) return;
    setError(null);
    chatApi
      .my()
      .then(setConversation)
      .catch((e) => setError(e.messages?.[0] || 'Не удалось открыть чат'));
  }, [open, isAuthenticated, conversation]);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener('chat:open', onOpen);
    return () => window.removeEventListener('chat:open', onOpen);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.cht-lightbox') && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`chat-fab chatw${open ? ' is-open' : ''}`}>
      {open && (
        <div className="chatw-panel" id="chatw-panel" role="dialog" aria-label="Чат с StarkTech">
          {!isAuthenticated ? (
            <div className="chatw-guest">
              <button type="button" className="chatw-guest__close" onClick={() => setOpen(false)} aria-label="Закрыть">
                ×
              </button>
              <div className="chatw-guest__art" aria-hidden="true">
                <BrandAvatar />
              </div>
              <h3>Чат с менеджером</h3>
              <p>Войдите, чтобы задать вопрос — ответим прямо здесь, а переписка сохранится в вашем аккаунте.</p>
              <Link to="/login" state={{ from: pathname }} className="btn btn--primary btn--block" onClick={() => setOpen(false)}>
                Войти
              </Link>
              <Link to="/register" state={{ from: pathname }} className="btn btn--ghost btn--block" onClick={() => setOpen(false)}>
                Регистрация
              </Link>
              <p className="chatw-guest__or">или напишите нам в мессенджер</p>
              <Messengers />
            </div>
          ) : conversation ? (
            <ChatThread
              conversation={conversation}
              role="Customer"
              hub={hub}
              myId={profile?.id}
              title="StarkTech"
              avatar={<BrandAvatar />}
              onlineLabel="Менеджер в сети"
              offlineLabel="Обычно отвечаем в течение часа"
              onClose={() => setOpen(false)}
              quickReplies={QUICK}
              empty={
                <>
                  <strong>Здравствуйте! 👋</strong>
                  <p>Спросите о стикерах, брелках, сроках или своём заказе — менеджер ответит здесь. Можно прислать фото.</p>
                  <p className="chatw-alt">Удобнее в мессенджере?</p>
                  <Messengers />
                </>
              }
            />
          ) : (
            <div className="chatw-guest">
              <button type="button" className="chatw-guest__close" onClick={() => setOpen(false)} aria-label="Закрыть">
                ×
              </button>
              <p>{error || 'Открываем чат…'}</p>
              {error && <Messengers />}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        className="chat-fab__toggle chatw-toggle"
        aria-expanded={open}
        aria-controls="chatw-panel"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 5h16v11H9l-5 4z" />
          </svg>
        )}
        <span>{open ? 'Закрыть' : 'Написать нам'}</span>
        {!open && unread > 0 && (
          <b className="chatw-badge" aria-label={`Непрочитанных: ${unread}`}>
            {unread > 99 ? '99+' : unread}
          </b>
        )}
      </button>
    </div>
  );
}
