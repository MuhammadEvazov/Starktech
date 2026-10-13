// Кнопка «Написать нам» + окно чата с менеджером (SignalR). Гостю предлагаем войти — переписка
// привязана к аккаунту и сохраняется; мессенджеры остаются запасным путём.
// Открыть чат из любого места сайта: window.dispatchEvent(new Event('chat:open')).
import '../../styles/chat.css';
import { useEffect, useRef, useState } from 'react';
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
  const { isAuthenticated, profile, session } = useAuth();
  // id пользователя берём из токена — он известен сразу, без ожидания загрузки профиля.
  const userId = isAuthenticated ? (session?.userId ?? profile?.id ?? null) : null;
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState(null);
  const hub = useChatHub(isAuthenticated);
  const toggleRef = useRef(null);
  const panelRef = useRef(null);
  const returnFocus = useRef(false);

  // Сменился пользователь (выход/вход другим) — забываем прошлую переписку. Загрузка профиля
  // того же пользователя бейдж не сбрасывает: сравниваем с предыдущим id.
  const prevUser = useRef(userId);
  useEffect(() => {
    if (prevUser.current === userId) return;
    prevUser.current = userId;
    setConversation(null);
    setUnread(0);
    setError(null);
  }, [userId]);

  // Непрочитанные ответы — бейдж на кнопке; обновляем и после переподключения.
  useEffect(() => {
    if (!userId) return undefined;
    let alive = true;
    chatApi
      .unread()
      .then((u) => alive && setUnread(u?.mine ?? 0))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [userId, hub.connected]);

  useHubEvent(hub.connection, 'ConversationUpdated', (c) => {
    // Сотрудник получает обновления всех переписок — берём только свою.
    if (!userId || String(c.customerId) !== String(userId)) return;
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

  // Закрытие крестиком/Escape/кнопкой возвращает фокус на кнопку чата (после отрисовки — на телефоне она скрыта, пока окно открыто).
  const close = () => {
    returnFocus.current = true;
    setOpen(false);
  };
  useEffect(() => {
    if (!open && returnFocus.current) {
      returnFocus.current = false;
      toggleRef.current?.focus();
    }
  }, [open]);

  // Открыли окно — фокус внутрь: в поле ввода, когда переписка загружена, иначе на саму панель.
  const ready = !!conversation;
  useEffect(() => {
    if (!open) return undefined;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const active = document.activeElement;
      // Пользователь уже ушёл фокусом внутрь окна — не перехватываем.
      if (panel.contains(active) && active !== panel) return;
      const field = panel.querySelector('textarea');
      (field || panel).focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [open, ready, isAuthenticated]);

  useEffect(() => {
    if (!open) return undefined;
    // Escape внутри переписки (отмена ответа/правки, меню, смайлики) обрабатывает ChatThread и делает preventDefault —
    // тогда окно не закрываем. Просмотр фото закрывается своим обработчиком.
    const onKey = (e) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      if (document.querySelector('.cht-lightbox')) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`chat-fab chatw${open ? ' is-open' : ''}`}>
      <button
        ref={toggleRef}
        type="button"
        className="chat-fab__toggle chatw-toggle"
        aria-expanded={open}
        aria-controls={open ? 'chatw-panel' : undefined}
        onClick={() => (open ? close() : setOpen(true))}
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
          <>
            <b className="chatw-badge" aria-hidden="true">
              {unread > 99 ? '99+' : unread}
            </b>
            <span className="sr-only">, непрочитанных: {unread}</span>
          </>
        )}
      </button>

      {/* Панель идёт после кнопки в DOM (порядок Tab), а над ней визуально — через order в chat.css */}
      {open && (
        <div className="chatw-panel" id="chatw-panel" role="dialog" aria-label="Чат с StarkTech" tabIndex={-1} ref={panelRef}>
          {!isAuthenticated ? (
            <div className="chatw-guest">
              <button type="button" className="chatw-guest__close" onClick={close} aria-label="Закрыть">
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
              myId={profile?.id ?? userId}
              title="StarkTech"
              avatar={<BrandAvatar />}
              onlineLabel="Менеджер в сети"
              offlineLabel="Обычно отвечаем в течение часа"
              onClose={close}
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
              <button type="button" className="chatw-guest__close" onClick={close} aria-label="Закрыть">
                ×
              </button>
              <p role="status">{error || 'Открываем чат…'}</p>
              {error && <Messengers />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
