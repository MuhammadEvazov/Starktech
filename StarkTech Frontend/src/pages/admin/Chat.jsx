// Админка → Чат: все переписки с клиентами в реальном времени (SignalR) — список слева, диалог справа.
// Выбранная переписка хранится в адресе (?c=id), поэтому на неё можно дать ссылку, например со страницы заказа.
import '../../styles/chat.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearch } from '../../lib/router.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { chatApi } from '../../api/endpoints.js';
import { assetUrl } from '../../api/client.js';
import { useChatHub, useHubEvent } from '../../lib/chatHub.js';
import ChatThread from '../../components/chat/ChatThread.jsx';

const FILTERS = [
  { key: 'all', label: 'Все' },
  { key: 'unread', label: 'Непрочитанные' },
  { key: 'open', label: 'Открытые' },
  { key: 'closed', label: 'Закрытые' },
];

const matches = (c, filter) =>
  filter === 'unread' ? c.unreadByStaff > 0 : filter === 'open' ? !c.isClosed : filter === 'closed' ? c.isClosed : true;

const byLast = (a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt);

function listTime(d) {
  const date = new Date(d);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const diffDays = (now - date) / 86400000;
  if (diffDays < 6) return date.toLocaleDateString('ru-RU', { weekday: 'short' });
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

/** Телефон в ссылку WhatsApp: только цифры, с кодом Таджикистана. */
const waPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  return digits.length === 9 ? `992${digits}` : digits;
};

function Avatar({ c, online }) {
  const letter = (c.customerName || c.customerEmail || '?').trim()[0]?.toUpperCase();
  return (
    <span className="achat-avatar">
      {c.customerAvatarUrl ? <img src={assetUrl(c.customerAvatarUrl)} alt="" /> : <span>{letter}</span>}
      {online && <i className="cht-dot" role="img" aria-label="в сети" />}
    </span>
  );
}

export default function AdminChat() {
  const { profile, session } = useAuth();
  const toast = useToast();
  const hub = useChatHub(true);
  const [params, setParams] = useSearch();
  const selectedId = params.c || null;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [online, setOnline] = useState(() => new Set());
  const [selected, setSelected] = useState(null);

  const load = useCallback(() => {
    setError(null);
    return chatApi
      .conversations({ search: search.trim() || undefined, filter: filter === 'all' ? undefined : filter, pageSize: 100 })
      .then((r) => setItems(r.items))
      .catch((e) => setError(e.messages?.[0] || 'Не удалось загрузить переписки'))
      .finally(() => setLoading(false));
  }, [search, filter]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  // После (пере)подключения — свежий список и кто онлайн.
  useEffect(() => {
    if (!hub.connected) return;
    load();
    hub.connection
      .invoke('GetOnlineProfiles')
      .then((ids) => setOnline(new Set(ids)))
      .catch(() => {});
  }, [hub.connected]); // eslint-disable-line react-hooks/exhaustive-deps

  useHubEvent(hub.connection, 'ConversationUpdated', (c) => {
    if (!c.lastMessagePreview) return; // пустые переписки в списке не показываем
    setItems((list) => {
      const rest = list.filter((x) => x.id !== c.id);
      const keep = matches(c, filter) || c.id === selectedId;
      return keep ? [c, ...rest].sort(byLast) : rest;
    });
    setSelected((cur) => (cur && cur.id === c.id ? c : cur));
  });

  useHubEvent(hub.connection, 'Presence', (p) => {
    setOnline((prev) => {
      const next = new Set(prev);
      if (p.online) next.add(p.profileId);
      else next.delete(p.profileId);
      return next;
    });
  });

  // Выбранная переписка: из списка, а если её там нет (ссылка из заказа) — с сервера.
  useEffect(() => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    const inList = items.find((c) => c.id === selectedId);
    if (inList) {
      setSelected(inList);
      return;
    }
    if (selected?.id === selectedId) return;
    chatApi
      .conversation(selectedId)
      .then(setSelected)
      .catch(() => {
        toast('Переписка не найдена');
        setParams({});
      });
  }, [selectedId, items]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalUnread = useMemo(() => items.reduce((s, c) => s + c.unreadByStaff, 0), [items]);

  const toggleClosed = async () => {
    try {
      const updated = await chatApi.setClosed(selected.id, !selected.isClosed);
      setSelected(updated);
      toast(updated.isClosed ? 'Диалог закрыт' : 'Диалог снова открыт');
    } catch (e) {
      toast(e.messages?.[0] || 'Не удалось изменить диалог');
    }
  };

  const wa = selected && waPhone(selected.customerPhone);

  return (
    <div className={`achat${selected ? ' has-thread' : ''}`}>
      <aside className="achat-side" aria-label="Переписки">
        <div className="achat-side__head">
          <h1>
            Чат
            {totalUnread > 0 && (
              <span className="achat-count">
                <span className="sr-only">непрочитанных: </span>
                {totalUnread}
              </span>
            )}
          </h1>
          <span className={`achat-conn${hub.connected ? ' is-on' : ''}`}>{hub.connected ? 'online' : 'подключение…'}</span>
        </div>
        <input
          className="input achat-search"
          type="search"
          placeholder="Поиск: имя, email, телефон"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Поиск переписки"
        />
        {/* Фильтр — группа кнопок-переключателей (у tablist нет панелей и навигации стрелками) */}
        <div className="achat-filters" role="group" aria-label="Фильтр переписок">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              className={filter === f.key ? 'is-active' : ''}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ul className="achat-list">
          {loading && !items.length && <li className="achat-note">Загружаем…</li>}
          {error && (
            <li className="achat-note is-error" role="alert">
              {error}
            </li>
          )}
          {!loading && !error && !items.length && (
            <li className="achat-note">{search || filter !== 'all' ? 'Ничего не найдено' : 'Клиенты ещё не писали в чат'}</li>
          )}
          {items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className={`achat-item${c.id === selectedId ? ' is-active' : ''}${c.unreadByStaff > 0 ? ' is-unread' : ''}`}
                onClick={() => setParams({ c: c.id })}
              >
                <Avatar c={c} online={online.has(c.customerId)} />
                <span className="achat-item__body">
                  <span className="achat-item__top">
                    <strong>{c.customerName || c.customerEmail}</strong>
                    <time dateTime={c.lastMessageAt}>{listTime(c.lastMessageAt)}</time>
                  </span>
                  <span className="achat-item__bottom">
                    <span className="achat-item__preview">{c.lastMessagePreview}</span>
                    {c.isClosed && <span className="achat-tag">закрыт</span>}
                    {c.unreadByStaff > 0 && (
                      <b className="achat-badge">
                        <span className="sr-only">непрочитанных: </span>
                        {c.unreadByStaff}
                      </b>
                    )}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="achat-main">
        {selected ? (
          <ChatThread
            key={selected.id}
            conversation={selected}
            role="Staff"
            hub={hub}
            myId={profile?.id ?? session?.userId}
            title={selected.customerName || selected.customerEmail}
            avatar={<Avatar c={selected} />}
            onlineLabel="в сети"
            offlineLabel="не в сети"
            onBack={() => setParams({})}
            headerActions={
              <button type="button" className={`cht-chip${selected.isClosed ? '' : ' is-ghost'}`} onClick={toggleClosed}>
                {selected.isClosed ? 'Открыть' : 'Закрыть диалог'}
              </button>
            }
            banner={
              <div className="achat-client">
                <a href={`mailto:${selected.customerEmail}`}>{selected.customerEmail}</a>
                {selected.customerPhone && <a href={`tel:${selected.customerPhone}`}>{selected.customerPhone}</a>}
                {wa && (
                  <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp
                  </a>
                )}
              </div>
            }
            empty={<p>Сообщений пока нет. Напишите клиенту первым.</p>}
          />
        ) : (
          <div className="achat-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 5h16v11H9l-5 4z" />
            </svg>
            <p>Выберите переписку слева</p>
            <span>Новые сообщения клиентов появляются здесь сразу, без обновления страницы.</span>
          </div>
        )}
      </div>
    </div>
  );
}
