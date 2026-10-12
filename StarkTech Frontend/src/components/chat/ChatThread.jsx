// Переписка в реальном времени — общая для виджета «Написать нам» (role="Customer")
// и страницы чата в админке (role="Staff"). Сообщения, правка, удаление, «печатает…» и прочтение
// идут через SignalR (lib/chatHub.js), история и фото — через REST (chatApi).
import '../../styles/chat.css';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { chatApi } from '../../api/endpoints.js';
import { assetUrl } from '../../api/client.js';
import { useHubEvent } from '../../lib/chatHub.js';

const PAGE = 40;
const EMOJI = ['😊', '😂', '😍', '🥰', '👍', '🙏', '❤️', '🔥', '🎉', '✨', '👌', '🤝', '😉', '🙂', '👋', '💯', '😎', '🤔', '😮', '😢', '📷', '🎁', '✅', '⭐'];

const time = (d) => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

function dayLabel(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Сегодня';
  if (date.toDateString() === yesterday.toDateString()) return 'Вчера';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  });
}

/** Объединить списки сообщений без дублей (по id) в порядке времени. */
function merge(a, b) {
  const map = new Map();
  [...a, ...b].forEach((m) => map.set(m.id, m));
  return [...map.values()].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
}

// Ошибка из хаба приходит как "...HubException: текст" — показываем только текст.
const hubError = (err, fallback) => {
  const msg = String(err?.message || '');
  const i = msg.lastIndexOf('HubException: ');
  return i >= 0 ? msg.slice(i + 14) : err?.messages?.[0] || fallback;
};

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;
function Linkified({ text }) {
  return text.split(URL_RE).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

const Icon = {
  back: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" />
    </svg>
  ),
  close: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  clip: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 11.5l-8.6 8.6a5 5 0 0 1-7.1-7.1l8.6-8.6a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-2.9-2.8l7.9-7.9" />
    </svg>
  ),
  send: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M3.4 20.4l17.4-7.5a1 1 0 0 0 0-1.8L3.4 3.6a1 1 0 0 0-1.4 1.1L4 11l9 1-9 1-2 6.3a1 1 0 0 0 1.4 1.1z" />
    </svg>
  ),
  check: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12l5 5 9-10" />
    </svg>
  ),
  smile: (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5c1 1.3 2.1 2 3.5 2s2.5-.7 3.5-2" />
      <circle cx="9" cy="10" r="0.6" fill="currentColor" />
      <circle cx="15" cy="10" r="0.6" fill="currentColor" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  ),
  down: (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  ),
};

/** Галочки: одна — отправлено, две синие — прочитано. */
function Ticks({ read }) {
  return (
    <span className={`cht-ticks${read ? ' is-read' : ''}`} aria-label={read ? 'Прочитано' : 'Отправлено'}>
      <svg viewBox="0 0 20 12" width="18" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 6.5l3.5 3.5L11 2" />
        {read && <path d="M7.5 9.5L8 10l7-8" />}
      </svg>
    </span>
  );
}

/** Цитата сообщения, на которое отвечают. */
function Quote({ reply, onClick }) {
  const text = reply.isDeleted ? 'Сообщение удалено' : reply.text || (reply.hasAttachment ? '📷 Фото' : '');
  return (
    <button type="button" className="cht-quote" onClick={onClick}>
      <strong>{reply.senderName}</strong>
      <span>{text}</span>
    </button>
  );
}

/**
 * @param conversation  переписка (ChatConversationDto)
 * @param role          'Customer' | 'Staff' — с какой стороны смотрим
 * @param hub           результат useChatHub()
 * @param myId          id профиля: свои сообщения можно менять и удалять
 */
export default function ChatThread({
  conversation,
  role,
  hub,
  myId,
  title,
  avatar,
  onlineLabel = 'в сети',
  offlineLabel = 'не в сети',
  headerActions,
  banner,
  onBack,
  onClose,
  quickReplies,
  empty,
}) {
  const id = conversation?.id;
  const { connection, connected, state } = hub;
  const staffSide = role === 'Staff';

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const [newBelow, setNewBelow] = useState(0);
  const [flash, setFlash] = useState(null);
  const [dragging, setDragging] = useState(false);

  const listRef = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const stickBottom = useRef(true);
  const prevHeight = useRef(null);
  const typingTimer = useRef(null);
  const lastTypingSent = useRef(0);

  // Справа — сообщения «нашей» стороны (клиент видит свои справа, сотрудник — ответы магазина).
  const isRight = (m) => (staffSide ? m.isFromStaff : !m.isFromStaff);
  const isOwn = (m) => (myId ? m.senderId === myId : isRight(m));
  const fromPeer = (m) => (staffSide ? !m.isFromStaff : m.isFromStaff);

  const nearBottom = () => {
    const el = listRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 90;
  };
  const scrollToBottom = (smooth) => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
    stickBottom.current = true;
    setNewBelow(0);
  };

  const markRead = useCallback(() => {
    if (!connection || connection.state !== 'Connected' || !id) return;
    if (document.visibilityState !== 'visible') return;
    connection.invoke('MarkRead', id).catch(() => {});
  }, [connection, id]);

  // ── История ──
  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setLoading(true);
    setMessages([]);
    setReplyTo(null);
    setEditing(null);
    setDeleting(null);
    setText('');
    setError('');
    setTyping(false);
    stickBottom.current = true;
    chatApi
      .messages(id, { take: PAGE })
      .then((list) => {
        if (!active) return;
        setMessages(list);
        setHasMore(list.length === PAGE);
      })
      .catch((e) => active && setError(e.messages?.[0] || 'Не удалось загрузить сообщения'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  // ── Вход в переписку на сервере (и повторно после переподключения) ──
  useEffect(() => {
    if (!id || !connected || !connection) return undefined;
    let active = true;
    connection
      .invoke('JoinConversation', id)
      .then((info) => {
        if (!active) return;
        setPeerOnline(staffSide ? !!info?.customerOnline : !!info?.staffOnline);
        // Пока не было связи, могли прийти сообщения — догружаем последние.
        chatApi
          .messages(id, { take: PAGE })
          .then((list) => active && setMessages((prev) => merge(prev, list)))
          .catch(() => {});
        markRead();
      })
      .catch((e) => active && setError(hubError(e, 'Нет доступа к переписке')));
    return () => {
      active = false;
      if (connection.state === 'Connected') connection.invoke('LeaveConversation', id).catch(() => {});
    };
  }, [id, connected, connection, staffSide, markRead]);

  useEffect(() => {
    const onVisible = () => markRead();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [markRead]);

  useEffect(() => () => clearTimeout(typingTimer.current), []);

  // ── События хаба ──
  useHubEvent(connection, 'MessageReceived', (m) => {
    if (m.conversationId !== id) return;
    if (!nearBottom() && fromPeer(m)) setNewBelow((n) => n + 1);
    setMessages((prev) => merge(prev, [m]));
    if (fromPeer(m)) {
      setTyping(false);
      markRead();
    }
  });
  useHubEvent(connection, 'MessageUpdated', (m) => {
    if (m.conversationId !== id) return;
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id === m.id) return m;
        if (x.replyTo?.id === m.id) return { ...x, replyTo: { ...x.replyTo, text: m.text, isDeleted: m.isDeleted } };
        return x;
      }),
    );
  });
  useHubEvent(connection, 'MessagesRead', (r) => {
    if (r.conversationId !== id) return;
    // byStaff — прочитал сотрудник, значит прочитаны сообщения клиента (и наоборот).
    setMessages((prev) => prev.map((m) => (!m.readAt && m.isFromStaff !== r.byStaff ? { ...m, readAt: r.readAt } : m)));
  });
  useHubEvent(connection, 'Typing', (t) => {
    if (t.conversationId !== id || t.fromStaff === staffSide) return;
    setTyping(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => setTyping(false), 3500);
  });
  useHubEvent(connection, 'StaffPresence', (online) => {
    if (!staffSide) setPeerOnline(!!online);
  });
  useHubEvent(connection, 'Presence', (p) => {
    if (staffSide && p.profileId === conversation?.customerId) setPeerOnline(p.online);
  });

  // ── Прокрутка: держимся низа, при подгрузке истории сохраняем позицию ──
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (prevHeight.current != null) {
      el.scrollTop = el.scrollHeight - prevHeight.current;
      prevHeight.current = null;
      return;
    }
    if (stickBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, typing, loading]);

  const loadOlder = async () => {
    if (!messages.length) return;
    setLoadingOlder(true);
    try {
      const list = await chatApi.messages(id, { take: PAGE, before: messages[0].createdAt });
      prevHeight.current = listRef.current?.scrollHeight ?? null;
      setMessages((prev) => merge(list, prev));
      setHasMore(list.length === PAGE);
    } catch {
      /* попробуем при следующей прокрутке */
    } finally {
      setLoadingOlder(false);
    }
  };

  const onScroll = () => {
    const bottom = nearBottom();
    stickBottom.current = bottom;
    setAtBottom(bottom);
    if (bottom) setNewBelow(0);
    if (listRef.current.scrollTop < 60 && hasMore && !loadingOlder) loadOlder();
  };

  const jumpTo = (messageId) => {
    const el = document.getElementById(`cht-m-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setFlash(messageId);
    setTimeout(() => setFlash(null), 1400);
  };

  // ── Ввод ──
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const onChange = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (connected && e.target.value.trim() && now - lastTypingSent.current > 2500) {
      lastTypingSent.current = now;
      connection.invoke('Typing', id).catch(() => {});
    }
  };

  const send = async (raw) => {
    const value = raw.trim();
    if (!value || busy || !connected) return;
    setBusy(true);
    setError('');
    try {
      if (editing) {
        const m = await connection.invoke('EditMessage', id, editing.id, value);
        setMessages((prev) => prev.map((x) => (x.id === m.id ? m : x)));
        setEditing(null);
      } else {
        stickBottom.current = true;
        const m = await connection.invoke('SendMessage', id, value, replyTo?.id ?? null);
        setMessages((prev) => merge(prev, [m]));
        setReplyTo(null);
      }
      setText('');
      setShowEmoji(false);
    } catch (err) {
      setError(hubError(err, 'Не удалось отправить сообщение'));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const sendPhoto = async (file) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
      setError('Можно отправить фото в формате JPG, PNG или WEBP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Фото больше 5 МБ — уменьшите его и попробуйте снова.');
      return;
    }
    setBusy(true);
    setError('');
    stickBottom.current = true;
    try {
      const m = await chatApi.sendPhoto(id, file, { text: text.trim() || undefined, replyToId: replyTo?.id });
      setMessages((prev) => merge(prev, [m]));
      setText('');
      setReplyTo(null);
    } catch (err) {
      setError(err.messages?.[0] || 'Не удалось отправить фото');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirmDelete = async () => {
    const m = deleting;
    setDeleting(null);
    try {
      const updated = await connection.invoke('DeleteMessage', id, m.id);
      setMessages((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
    } catch (err) {
      setError(hubError(err, 'Не удалось удалить сообщение'));
    }
  };

  const insertEmoji = (emoji) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const cancelMode = () => {
    if (editing) setText('');
    setEditing(null);
    setReplyTo(null);
    setDeleting(null);
    setShowEmoji(false);
  };

  const startReply = (m) => {
    setEditing(null);
    setDeleting(null);
    setReplyTo(m);
    setMenuFor(null);
    inputRef.current?.focus();
  };
  const startEdit = (m) => {
    setReplyTo(null);
    setDeleting(null);
    setEditing(m);
    setText(m.text || '');
    setMenuFor(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };
  const copy = (m) => {
    navigator.clipboard?.writeText(m.text || '').catch(() => {});
    setMenuFor(null);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send(text);
    } else if (e.key === 'Escape') {
      cancelMode();
    } else if (e.key === 'ArrowUp' && !text) {
      // Как в мессенджерах: ↑ в пустом поле — изменить последнее своё сообщение.
      const last = [...messages].reverse().find((m) => isOwn(m) && !m.isDeleted && m.text);
      if (last) {
        e.preventDefault();
        startEdit(last);
      }
    }
  };

  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      sendPhoto(file);
    }
  };

  useEffect(() => {
    if (!lightbox) return undefined;
    const onKey = (e) => e.key === 'Escape' && setLightbox(null);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [lightbox]);

  const status = typing
    ? 'печатает…'
    : !connected
      ? state === 'Reconnecting' || state === 'Connecting'
        ? 'Подключаемся…'
        : 'Нет связи — переподключаемся'
      : peerOnline
        ? onlineLabel
        : offlineLabel;

  // ── Отрисовка ленты: разделители дней и группы подряд идущих сообщений ──
  const rows = [];
  let prevDay = null;
  messages.forEach((m, i) => {
    const day = new Date(m.createdAt).toDateString();
    if (day !== prevDay) {
      rows.push(
        <li key={`d-${day}`} className="cht-day">
          <span>{dayLabel(m.createdAt)}</span>
        </li>,
      );
      prevDay = day;
    }
    const prev = messages[i - 1];
    const groupStart =
      !prev ||
      prev.senderId !== m.senderId ||
      new Date(prev.createdAt).toDateString() !== day ||
      new Date(m.createdAt) - new Date(prev.createdAt) > 5 * 60 * 1000;
    const right = isRight(m);
    const own = isOwn(m);
    const showName = groupStart && (right ? !own : m.isFromStaff);
    const open = menuFor === m.id;

    rows.push(
      <li
        key={m.id}
        id={`cht-m-${m.id}`}
        className={`cht-msg${right ? ' is-right' : ''}${groupStart ? ' is-start' : ''}${flash === m.id ? ' is-flash' : ''}`}
      >
        {showName && (
          <span className="cht-msg__name">
            {m.senderName}
            {m.isFromStaff && !staffSide && <em> · StarkTech</em>}
          </span>
        )}
        <div className="cht-msg__row">
          <div
            className={`cht-bubble${m.isDeleted ? ' is-deleted' : ''}${m.attachmentUrl && !m.text ? ' is-photo' : ''}`}
            onClick={(e) => {
              if (m.isDeleted || e.target.closest('a, button')) return;
              setMenuFor(open ? null : m.id);
            }}
          >
            {m.replyTo && !m.isDeleted && <Quote reply={m.replyTo} onClick={() => jumpTo(m.replyTo.id)} />}
            {m.attachmentUrl && !m.isDeleted && (
              <button type="button" className="cht-photo" onClick={() => setLightbox(assetUrl(m.attachmentUrl))} aria-label="Открыть фото">
                <img
                  src={assetUrl(m.attachmentUrl)}
                  alt=""
                  loading="lazy"
                  onLoad={() => stickBottom.current && listRef.current && (listRef.current.scrollTop = listRef.current.scrollHeight)}
                />
              </button>
            )}
            {m.isDeleted ? (
              <p className="cht-text">Сообщение удалено</p>
            ) : (
              m.text && (
                <p className="cht-text">
                  <Linkified text={m.text} />
                </p>
              )
            )}
            <span className="cht-meta">
              {m.editedAt && !m.isDeleted && <span>изменено</span>}
              <time dateTime={m.createdAt}>{time(m.createdAt)}</time>
              {right && !m.isDeleted && <Ticks read={!!m.readAt} />}
            </span>
          </div>
          {!m.isDeleted && (
            <button
              type="button"
              className={`cht-more${open ? ' is-open' : ''}`}
              aria-label="Действия с сообщением"
              aria-expanded={open}
              onClick={() => setMenuFor(open ? null : m.id)}
            >
              {Icon.more}
            </button>
          )}
        </div>
        {open && (
          <div className="cht-menu" role="menu">
            <button type="button" role="menuitem" onClick={() => startReply(m)}>
              Ответить
            </button>
            {m.text && (
              <button type="button" role="menuitem" onClick={() => copy(m)}>
                Копировать
              </button>
            )}
            {own && m.text && (
              <button type="button" role="menuitem" onClick={() => startEdit(m)}>
                Изменить
              </button>
            )}
            {own && (
              <button
                type="button"
                role="menuitem"
                className="is-danger"
                onClick={() => {
                  setDeleting(m);
                  setMenuFor(null);
                }}
              >
                Удалить
              </button>
            )}
          </div>
        )}
      </li>,
    );
  });

  const barTarget = deleting || editing || replyTo;

  return (
    <section
      className={`cht${dragging ? ' is-dragging' : ''}`}
      aria-label={title}
      onDragOver={(e) => {
        if ([...(e.dataTransfer?.types || [])].includes('Files')) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        sendPhoto(e.dataTransfer?.files?.[0]);
      }}
    >
      <header className="cht-head">
        {onBack && (
          <button type="button" className="cht-iconbtn" onClick={onBack} aria-label="Назад к списку">
            {Icon.back}
          </button>
        )}
        <span className="cht-avatar">
          {avatar}
          {peerOnline && connected && <i className="cht-dot" aria-hidden="true" />}
        </span>
        <div className="cht-head__who">
          <strong>{title}</strong>
          <span className={`cht-status${typing ? ' is-typing' : ''}${peerOnline && connected ? ' is-online' : ''}`}>{status}</span>
        </div>
        {headerActions}
        {onClose && (
          <button type="button" className="cht-iconbtn" onClick={onClose} aria-label="Закрыть чат">
            {Icon.close}
          </button>
        )}
      </header>
      {banner}

      <div className="cht-body">
        <ul className="cht-list" ref={listRef} onScroll={onScroll} role="log" aria-live="polite" aria-busy={loading}>
          {loadingOlder && <li className="cht-loading">Загружаем историю…</li>}
          {loading && !messages.length ? (
            <li className="cht-loading">Загружаем переписку…</li>
          ) : !messages.length ? (
            <li className="cht-empty">
              {empty}
              {quickReplies?.length > 0 && (
                <div className="cht-quick">
                  {quickReplies.map((q) => (
                    <button key={q} type="button" onClick={() => send(q)} disabled={!connected || busy}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </li>
          ) : (
            rows
          )}
          {typing && (
            <li className="cht-msg cht-typing" aria-label="Собеседник печатает">
              <div className="cht-bubble">
                <i />
                <i />
                <i />
              </div>
            </li>
          )}
        </ul>
        {!atBottom && messages.length > 0 && (
          <button type="button" className="cht-down" onClick={() => scrollToBottom(true)} aria-label="К последним сообщениям">
            {Icon.down}
            {newBelow > 0 && <b>{newBelow}</b>}
          </button>
        )}
        {dragging && <div className="cht-drop">Отпустите, чтобы отправить фото</div>}
      </div>

      {conversation?.isClosed && (
        <p className="cht-closed">{staffSide ? 'Диалог закрыт. Новое сообщение откроет его снова.' : 'Диалог завершён. Напишите — и мы продолжим.'}</p>
      )}

      {barTarget && (
        <div className={`cht-bar${deleting ? ' is-danger' : ''}`}>
          <div className="cht-bar__text">
            <strong>{deleting ? 'Удалить сообщение?' : editing ? 'Редактирование' : `Ответ: ${replyTo.senderName}`}</strong>
            <span>{barTarget.text || (barTarget.attachmentUrl ? '📷 Фото' : '')}</span>
          </div>
          {deleting ? (
            <div className="cht-bar__actions">
              <button type="button" className="cht-chip is-danger" onClick={confirmDelete}>
                Удалить
              </button>
              <button type="button" className="cht-chip" onClick={() => setDeleting(null)}>
                Отмена
              </button>
            </div>
          ) : (
            <button type="button" className="cht-iconbtn" onClick={cancelMode} aria-label="Отменить">
              {Icon.close}
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="cht-error" role="alert">
          {error}
          <button type="button" onClick={() => setError('')} aria-label="Скрыть">
            ×
          </button>
        </p>
      )}

      <form
        className="cht-composer"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <button
          type="button"
          className="cht-iconbtn"
          onClick={() => fileRef.current?.click()}
          disabled={!connected || busy || !!editing}
          aria-label="Прикрепить фото"
          title="Прикрепить фото"
        >
          {Icon.clip}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => sendPhoto(e.target.files?.[0])} />
        <div className="cht-input">
          <textarea
            ref={inputRef}
            rows={1}
            maxLength={4000}
            value={text}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={connected ? 'Сообщение…' : 'Подключаемся…'}
            aria-label="Сообщение"
          />
          <button type="button" className="cht-iconbtn cht-input__emoji" onClick={() => setShowEmoji((s) => !s)} aria-label="Смайлики" aria-expanded={showEmoji}>
            {Icon.smile}
          </button>
          {showEmoji && (
            <div className="cht-emoji" role="dialog" aria-label="Смайлики">
              {EMOJI.map((e) => (
                <button key={e} type="button" onClick={() => insertEmoji(e)}>
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
        <button type="submit" className="cht-send" disabled={!connected || busy || !text.trim()} aria-label={editing ? 'Сохранить' : 'Отправить'}>
          {editing ? Icon.check : Icon.send}
        </button>
      </form>

      {lightbox && (
        <div className="cht-lightbox" role="dialog" aria-label="Фото" onClick={() => setLightbox(null)}>
          <img src={lightbox} alt="" />
          <button type="button" className="cht-iconbtn" aria-label="Закрыть">
            {Icon.close}
          </button>
        </div>
      )}
    </section>
  );
}
